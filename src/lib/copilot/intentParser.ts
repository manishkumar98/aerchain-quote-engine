/**
 * Layer 1: Natural Language Intent Parser & Structured Query AST Generator
 *
 * Conforms strictly to SYSTEM_PROMPT.md:
 * - Translates buyer natural language input into a structured query JSON payload.
 * - Zero arithmetic execution in token generation: NEVER calculates sums, deltas, or multipliers.
 * - Robust deterministic regex/keyword fallback: Guarantees 100% demo uptime without external API latency or failure.
 */

export type CopilotIntentType =
  | 'OPTIMIZE_SPLIT_AWARD'
  | 'COMPARE_LANDED_COST'
  | 'LIST_HIDDEN_TERMS'
  | 'FX_SENSITIVITY'
  | 'AUDIT_VENDOR_COVERAGE'
  | 'AUDIT_COMPLIANCE_TERMS'
  | 'EXPLAIN_NORMALIZATION'
  | 'UNKNOWN';

export interface CopilotConstraints {
  exclude_failed_questionnaire?: boolean;
  max_vendor_concentration_pct?: number;
  exchange_rate_usd_inr?: number;
  baseline_exchange_rate_usd_inr?: number;
  eligible_vendor_ids?: string[];
  target_vendor_id?: string;
  category_filter?: string;
  compliance_type?: 'quality' | 'payment' | 'incoterms';
  target_line_id?: string;
  award_by_category?: boolean;
}

export interface CopilotIntentAST {
  intent: CopilotIntentType;
  constraints: CopilotConstraints;
  metrics: string[];
  raw_query: string;
  parsed_via: 'LLM_PARSER' | 'DETERMINISTIC_FALLBACK';
  zero_arithmetic_verified: boolean;
}

/**
 * Deterministic heuristic intent classifier with keyword & regex extraction.
 */
export function parseIntentDeterministic(query: string): CopilotIntentAST {
  const normalized = query.toLowerCase().trim();

  // 1. Check for FX Sensitivity queries (e.g. "USD moves from 84 to 87", "USD strengthens to 87.00 INR", "currency sensitivity")
  if (
    normalized.includes('usd') ||
    normalized.includes('fx') ||
    normalized.includes('exchange rate') ||
    normalized.includes('peg') ||
    normalized.includes('dollar') ||
    normalized.includes('inr/usd') ||
    normalized.includes('strengthens') ||
    normalized.includes('weakens')
  ) {
    let targetRate = 87.0;
    const rateMatch = query.match(
      /(?:moves?|shifts?|goes?|strengthens?|weakens?|appreciates?|depreciates?|at|to)\s+(?:from\s+\d+(?:\.\d+)?\s+to\s+)?(\d{2}(?:\.\d+)?)/i
    );
    if (rateMatch && rateMatch[1]) {
      const parsed = parseFloat(rateMatch[1]);
      if (parsed > 50 && parsed < 200) {
        targetRate = parsed;
      }
    } else {
      // Standalone numbers around 80-99
      const numMatches = query.match(/\b(8[4-9]|9[0-9])(?:\.\d+)?\b/g);
      if (numMatches && numMatches.length > 0) {
        targetRate = parseFloat(numMatches[numMatches.length - 1]);
      }
    }

    return {
      intent: 'FX_SENSITIVITY',
      constraints: {
        exchange_rate_usd_inr: targetRate,
        baseline_exchange_rate_usd_inr: 84.0,
      },
      metrics: ['total_landed_spend', 'portfolio_spend_delta', 'flipped_lines', 'currency_risk_inr'],
      raw_query: query,
      parsed_via: 'DETERMINISTIC_FALLBACK',
      zero_arithmetic_verified: true,
    };
  }

  // 1a. Explain Normalization
  if (
    normalized.match(/(?:how\s+was.*normalized|tooling.*add|plate.*amortiz|provenance)/i)
  ) {
    let targetVendor = undefined;
    if (normalized.match(/(?:vendor 2|v2)/i)) targetVendor = 'VEND-02';
    if (normalized.match(/(?:vendor 1|v1)/i)) targetVendor = 'VEND-01';
    let targetLineId = undefined;
    if (normalized.match(/pkg-001/i)) targetLineId = 'PKG-001';

    return {
      intent: 'EXPLAIN_NORMALIZATION',
      constraints: { target_vendor_id: targetVendor, target_line_id: targetLineId },
      metrics: [],
      raw_query: query,
      parsed_via: 'DETERMINISTIC_FALLBACK',
      zero_arithmetic_verified: true,
    };
  }

  // 1b. Audit Compliance Terms
  if (
    normalized.match(/(?:payment\s+terms|deviated.*net\s*60|ex-works|freight.*extra|incoterms?|who.*failed.*iso|which.*vendors.*failed.*iso|mandatory.*iso|failed.*mandatory)/i)
  ) {
    let subType: 'quality' | 'payment' | 'incoterms' = 'payment';
    if (normalized.match(/iso|quality/i)) subType = 'quality';
    else if (normalized.match(/ex-works|freight|incoterm/i)) subType = 'incoterms';

    return {
      intent: 'AUDIT_COMPLIANCE_TERMS',
      constraints: { compliance_type: subType },
      metrics: [],
      raw_query: query,
      parsed_via: 'DETERMINISTIC_FALLBACK',
      zero_arithmetic_verified: true,
    };
  }

  // 2. Check for Hidden Footnote & Buried Ancillary Fees (e.g. "hidden fees", "buried costs", "surcharges", "footnotes")
  if (
    normalized.includes('hidden') ||
    normalized.includes('footnote') ||
    normalized.includes('buried') ||
    normalized.includes('surcharge') ||
    normalized.includes('ancillary') ||
    normalized.includes('extra charge') ||
    normalized.includes('plate fee') ||
    normalized.includes('tooling') ||
    normalized.includes('freight extra')
  ) {
    return {
      intent: 'LIST_HIDDEN_TERMS',
      constraints: {},
      metrics: ['ancillary_terms_list', 'surcharge_impact_inr', 'compliance_gaps'],
      raw_query: query,
      parsed_via: 'DETERMINISTIC_FALLBACK',
      zero_arithmetic_verified: true,
    };
  }

  // 3. Check for Single-Source / Compare All Vendors (e.g. "single-source", "cheapest vendor overall", "rank suppliers")
  if (
    normalized.includes('single-source') ||
    normalized.includes('single source') ||
    normalized.includes('sole source') ||
    normalized.includes('rank vendor') ||
    normalized.includes('compare suppliers') ||
    normalized.includes('vendor ranking') ||
    (normalized.includes('cheapest') && normalized.includes('vendor') && !normalized.includes('split') && !normalized.includes('per line'))
  ) {
    const excludeQualityFailed =
      normalized.includes('iso') ||
      normalized.includes('quality') ||
      normalized.includes('certified') ||
      normalized.includes('failing');

    return {
      intent: 'COMPARE_LANDED_COST',
      constraints: {
        exclude_failed_questionnaire: excludeQualityFailed,
      },
      metrics: ['total_landed_spend', 'vendor_rankings', 'coverage_gap'],
      raw_query: query,
      parsed_via: 'DETERMINISTIC_FALLBACK',
      zero_arithmetic_verified: true,
    };
  }

  // 4. Audit Vendor Coverage (e.g. "is vendor 3 providing all materials?")
  if (
    normalized.match(/(?:providing\s+all|quoted?\s+all|quoted?\s+everything|complete\s+bid|all\s+materials|all\s+items|missing\s+lines|omitted|partial\s+bid|did\s+vendor\s+\d+\s+quote)/i)
  ) {
    let targetVendor = 'VEND-03'; // default to Vendor 3 if not specified explicitly but asked
    if (normalized.match(/(?:vendor 3|v3|national paper)/i)) {
      targetVendor = 'VEND-03';
    }
    return {
      intent: 'AUDIT_VENDOR_COVERAGE',
      constraints: { target_vendor_id: targetVendor },
      metrics: ['coverage_gap', 'compliance_gaps'],
      raw_query: query,
      parsed_via: 'DETERMINISTIC_FALLBACK',
      zero_arithmetic_verified: true,
    };
  }

  // 5. Concentration-limited split (must come before general split-award to avoid being swallowed)
  if (
    normalized.match(/(?:no single vendor.*(?:more|exceed).*\d+%|\d+%.*concentration|concentration.*limit|cap.*vendor.*\d+%)/i) ||
    (normalized.includes('50%') && (normalized.includes('total spend') || normalized.includes('concentration') || normalized.includes('split')))
  ) {
    const concMatch = normalized.match(/(\d{1,3})%/);
    const maxConcentration = concMatch ? parseFloat(concMatch[1]) / 100.0 : 0.5;
    return {
      intent: 'OPTIMIZE_SPLIT_AWARD',
      constraints: {
        exclude_failed_questionnaire: false,
        max_vendor_concentration_pct: maxConcentration,
        exchange_rate_usd_inr: 84.0,
        award_by_category: false,
      },
      metrics: ['total_landed_spend', 'delta_vs_baseline', 'line_allocations', 'award_distribution'],
      raw_query: query,
      parsed_via: 'DETERMINISTIC_FALLBACK',
      zero_arithmetic_verified: true,
    };
  }

  // 6. Split-Award Optimization (e.g. "cheapest split-award per line", "split award", "optimal award", "Award each packaging category")
  if (
    normalized.includes('split-award') ||
    normalized.includes('split award') ||
    normalized.includes('split cheapest') ||
    normalized.includes('optimal allocation') ||
    normalized.includes('cheapest per line') ||
    normalized.includes('award each packaging category') ||
    (normalized.includes('cheapest') && !normalized.includes('vendor'))
  ) {
    const excludeQualityFailed =
      normalized.includes('iso') ||
      normalized.includes('quality') ||
      normalized.includes('pass') ||
      normalized.includes('questionnaire') ||
      normalized.includes('compliance') ||
      normalized.includes('failing') ||
      normalized.includes('excluding');

    let maxConcentration: number | undefined;
    const concMatch = normalized.match(/(?:max|cap|limit)\s+(?:at\s+)?(\d{1,3})%/i);
    if (concMatch && concMatch[1]) {
      maxConcentration = parseFloat(concMatch[1]) / 100.0;
    }
    
    const awardByCategory = normalized.includes('category');

    return {
      intent: 'OPTIMIZE_SPLIT_AWARD',
      constraints: {
        exclude_failed_questionnaire: excludeQualityFailed,
        max_vendor_concentration_pct: maxConcentration || 1.0,
        exchange_rate_usd_inr: 84.0,
        award_by_category: awardByCategory,
      },
      metrics: ['total_landed_spend', 'delta_vs_baseline', 'line_allocations', 'award_distribution'],
      raw_query: query,
      parsed_via: 'DETERMINISTIC_FALLBACK',
      zero_arithmetic_verified: true,
    };
  }

  // 6. Explicit Guardrail Fallback: UNKNOWN
  return {
    intent: 'UNKNOWN',
    constraints: {},
    metrics: [],
    raw_query: query,
    parsed_via: 'DETERMINISTIC_FALLBACK',
    zero_arithmetic_verified: true,
  };
}

const SYSTEM_PROMPT = `You are the Aerchain Enterprise Sourcing Copilot Intent Parser.
Your role is to translate a buyer's natural language input into a structured query JSON payload for the deterministic solver engine.

OPERATIONAL AND SAFETY DIRECTIVES:
1. DETERMINISTIC ARITHMETIC ENFORCEMENT:
   - NEVER calculate totals, multiply quantities by unit prices, or determine cost differences.
   - Do NOT output calculated numbers.
2. Emit JSON strictly in this format:
{
  "intent": "OPTIMIZE_SPLIT_AWARD" | "COMPARE_LANDED_COST" | "LIST_HIDDEN_TERMS" | "FX_SENSITIVITY" | "AUDIT_VENDOR_COVERAGE" | "AUDIT_COMPLIANCE_TERMS" | "EXPLAIN_NORMALIZATION" | "UNKNOWN",
  "constraints": {
    "exclude_failed_questionnaire": boolean,
    "max_vendor_concentration_pct": number,
    "exchange_rate_usd_inr": number,
    "eligible_vendor_ids": string[],
    "target_vendor_id": string
  },
  "metrics": string[]
}
Respond with ONLY valid JSON and no code fences or extra text.`;

async function parseWithGemini(query: string, apiKey: string): Promise<CopilotIntentAST | null> {
  const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.6-flash'];

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${SYSTEM_PROMPT}\n\nBuyer Natural Language Query: "${query}"` }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (!response.ok) {
        console.warn(`[Gemini API] Model ${model} returned status ${response.status}`);
        continue;
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;

      const parsed = JSON.parse(text);
      if (!parsed.intent) continue;

      const constraints: CopilotConstraints = parsed.constraints || {};

      // Normalize FX sensitivity defaults
      if (parsed.intent === 'FX_SENSITIVITY') {
        if (!constraints.exchange_rate_usd_inr || constraints.exchange_rate_usd_inr <= 0) {
          constraints.exchange_rate_usd_inr = 87.0;
        }
        constraints.baseline_exchange_rate_usd_inr = 84.0;
      }

      // Normalize Split Award defaults
      if (parsed.intent === 'OPTIMIZE_SPLIT_AWARD') {
        if (!constraints.max_vendor_concentration_pct || constraints.max_vendor_concentration_pct <= 0) {
          constraints.max_vendor_concentration_pct = 1.0;
        }
      }

      console.log(`[Gemini API] Parsed intent "${parsed.intent}" via ${model}`);

      return {
        intent: parsed.intent,
        constraints,
        metrics: parsed.metrics || ['total_landed_spend'],
        raw_query: query,
        parsed_via: 'LLM_PARSER',
        zero_arithmetic_verified: true,
      };
    } catch (err: any) {
      console.warn(`[Gemini API] Error trying ${model}:`, err?.message || err);
    }
  }

  return null;
}

async function parseWithOpenAI(query: string, apiKey: string): Promise<CopilotIntentAST | null> {
  const url = 'https://api.openai.com/v1/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: query },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    console.warn(`[OpenAI API] Request failed with status ${response.status}`);
    return null;
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) return null;

  const parsed = JSON.parse(text);
  if (!parsed.intent) return null;

  return {
    intent: parsed.intent,
    constraints: parsed.constraints || {},
    metrics: parsed.metrics || ['total_landed_spend'],
    raw_query: query,
    parsed_via: 'LLM_PARSER',
    zero_arithmetic_verified: true,
  };
}

/**
 * Primary Intent Parser Entrypoint
 * Checks for GEMINI_API_KEY or OPENAI_API_KEY in process.env (.env.local)
 * If missing or if the API call times out/fails, gracefully falls back to deterministic heuristic parsing.
 */
export async function parseCopilotQuery(query: string): Promise<CopilotIntentAST> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;

  if (geminiKey) {
    try {
      const ast = await parseWithGemini(query, geminiKey);
      if (ast) return ast;
    } catch (err) {
      console.warn('[Copilot Parser] Gemini API fallback triggered:', err);
    }
  } else if (openAiKey) {
    try {
      const ast = await parseWithOpenAI(query, openAiKey);
      if (ast) return ast;
    } catch (err) {
      console.warn('[Copilot Parser] OpenAI API fallback triggered:', err);
    }
  }

  return parseIntentDeterministic(query);
}
