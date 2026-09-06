import fs from 'fs';
import path from 'path';
import { getDatabase } from './db';
import { exportAllTables } from '../../scripts/export_csv';
import { CANONICAL_LINE_ITEMS, MASTER_RFX } from '../../steps/step_1/seed';
import { runIngestionPipeline } from '../../steps/step_2/ingest';
import {
  calculatePeerMedian,
  evaluateGovernance,
} from '../../steps/step_2/normalizationEngine';

export interface ParsedLineItem {
  id: string;
  rfx_id: string;
  line_number: number;
  sku_name: string;
  spec_category: string;
  dimensions: string;
  spec_weight_kg: string;
  target_volume: number;
  baseline_benchmark_price: string;
}

/**
 * Assigns spec_category based on canonical line-number tier ranges:
 *   Lines 01–10  → 5-Ply Master Shippers
 *   Lines 11–20  → 3-Ply Universal Shipping Cartons
 *   Lines 21–27  → Die-Cut Self-Locking Mailers
 *   Lines 28–30  → Ancillary Protective Packaging
 */
function categoryForLine(num: number, inputText: string): string {
  // If the entire input covers only ONE tier (no multi-tier markers), use single-category detection
  const hasFivePly = /5-ply/i.test(inputText);
  const hasThreePly = /3-ply/i.test(inputText);
  const hasDieCut = /die-cut/i.test(inputText);
  const hasProtective = /protective|edge\s*protector|honeycomb|sealing\s*tape/i.test(inputText);
  const isMultiTier = [hasFivePly, hasThreePly, hasDieCut, hasProtective].filter(Boolean).length > 1;

  if (isMultiTier || (num >= 1 && num <= 10 && !hasThreePly && !hasDieCut)) {
    // Tier-based assignment for full 30-line specs
    if (num >= 1 && num <= 10) return '5-Ply Master';
    if (num >= 11 && num <= 20) return '3-Ply Universal';
    if (num >= 21 && num <= 27) return 'Die-Cut Mailer';
    if (num >= 28 && num <= 30) return 'Protective';
  }

  // Single-tier document: detect from content
  if (hasDieCut && !hasFivePly) return 'Die-Cut Mailer';
  if (hasThreePly && !hasFivePly) return '3-Ply Universal';
  if (hasProtective && !hasFivePly && !hasThreePly) return 'Protective';
  return '5-Ply Master';
}

/**
 * Strips all conversational lead phrases used in procurement spec prose, leaving
 * only the noun phrase (the actual SKU description). Handles verbs used in:
 * Lines 01–10: covers, specifies, encompasses, accounts for, targets, establishes, details, allocates, rounds out ... with
 * Lines 11–20: designates, introduces, captures, identifies, describes, defines, includes, presents, positions, marks
 * Lines 21–27: closes, provides, offers, represents, completes, features
 * Lines 28–30: finalizes, adds, slots in at, designates, serves
 */
function stripLeadVerb(chunk: string): string {
  return chunk.replace(
    // Full list of all intro verbs across Lines 01–30, plus multi-word phrase "closes the <word> with"
    /^Line\s*\d+\s*(?:covers|specifies|encompasses|accounts\s+for|targets|establishes|details|allocates|rounds\s+out(?:\s+the\s+\w+(?:\s+\w+)?)?\s*with|designates|introduces|captures|identifies|describes|defines|closes(?:\s+out)?(?:\s+the\s+\w+(?:\s+\w+)?\s+with)?|finalizes|provides|offers|presents|represents|completes|addresses|handles|serves|supports|features|delineates|outlines|adds(?:\s+in)?(?:\s+a)?|slots\s+in(?:\s+at)?|positions(?:\s+itself)?|marks(?:\s+out)?)?\s*(?:the\s*)?/i,
    ''
  );
}

/**
 * Deterministic regex parser for natural language line item text blocks.
 *
 * Handles 4 packaging tiers across 30 lines:
 *   Lines 01–10: 5-Ply Master Shippers      (box with LxWxH mm, spec_weight_kg, volume in units)
 *   Lines 11–20: 3-Ply Universal Cartons     (box with LxWxH mm, spec_weight_kg, volume in units)
 *   Lines 21–27: Die-Cut Self-Locking Mailers (box with LxWxH mm, spec_weight_kg, volume in units)
 *   Lines 28–30: Protective Packaging        (non-box: pieces/pads/rolls — different dim/weight defaults)
 */
export function parseLineItemsRegex(input: string): ParsedLineItem[] {
  const items: ParsedLineItem[] = [];
  const regex = /Line\s*(\d+)[\s\S]*?(?=(?:Line\s*\d+|$))/gi;
  let match;

  while ((match = regex.exec(input)) !== null) {
    const chunk = match[0];
    const num = parseInt(match[1], 10);
    const id = `PKG-${String(num).padStart(3, '0')}`;

    const isProtective = num >= 28;

    // ── Dimensions ──────────────────────────────────────────────────────────
    // Supports all item geometries in a cascading priority order:
    //   3D (box):   "600x400x400mm" | "600 x 400 x 400 mm"
    //   2D (roll/sheet/pad): "72 mm x 50 m" | "300x200mm"
    //   1D (length/roll): "50 m" | "1000 mm"
    // Mixed units (mm × m) are preserved as-is (e.g. "72mmx50m").
    // Falls back to 'N/A' only when no measurement is found and item is protective.

    // A single measurement component: digits + optional unit (mm | cm | m | in | ft)
    const DIM_COMP = String.raw`\d+(?:\.\d+)?\s*(?:mm|cm|m|in|ft)?`;
    const SEP = String.raw`\s*[xX×]\s*`; // separator between components

    // 3D match: N[unit] x N[unit] x N[unit]  — must have exactly two separators
    const match3d = chunk.match(
      new RegExp(`(${DIM_COMP}${SEP}${DIM_COMP}${SEP}${DIM_COMP})`, 'i')
    );
    // 2D match: N[unit] x N[unit]  — one separator, not preceded/followed by another dimension
    const match2d = !match3d
      ? chunk.match(new RegExp(`(${DIM_COMP}${SEP}${DIM_COMP})`, 'i'))
      : null;
    // 1D match: standalone N mm | N m | N cm (only for clearly non-box protective items)
    const match1d = !match3d && !match2d
      ? chunk.match(/(\d+(?:\.\d+)?)\s*(mm|cm|m|in|ft)\b/i)
      : null;

    let dimensions: string;
    if (match3d) {
      // Compact: remove internal spaces, ensure trailing 'mm' if no unit present
      dimensions = match3d[1].replace(/\s+/g, '');
      // If the whole string has no unit letters at all, append 'mm'
      if (!/[a-z]/i.test(dimensions)) dimensions += 'mm';
    } else if (match2d) {
      dimensions = match2d[1].replace(/\s+/g, '');
      if (!/[a-z]/i.test(dimensions)) dimensions += 'mm';
    } else if (match1d) {
      dimensions = `${match1d[1]}${match1d[2]}`;
    } else {
      dimensions = isProtective ? 'N/A' : '500x350x300mm';
    }

    // ── Volume ──────────────────────────────────────────────────────────────
    // Handles: "100,000 units", "80,000-unit volume", "8,000 rolls", "5,000 pads"
    const volMatch =
      chunk.match(/([\d,]+)\s*(?:rolls|pads?|pieces?|units?|pcs)/i) ||
      chunk.match(/([\d,]+)[\s-]*unit/i) ||
      chunk.match(/volume\s*(?:of)?\s*([\d,]+)/i);
    const volume = volMatch ? parseInt(volMatch[1].replace(/,/g, ''), 10) : (isProtective ? 5000 : 50000);

    // ── Weight ──────────────────────────────────────────────────────────────
    const weightMatch = chunk.match(/(\d+(?:\.\d+)?)\s*kg/i);
    // Protective items are lighter; tape/pad weight typically 0.10–0.25 kg
    const weight = weightMatch
      ? parseFloat(weightMatch[1]).toFixed(2)
      : (isProtective ? '0.15' : '1.00');

    // ── Benchmark Price ──────────────────────────────────────────────────────
    const priceMatch =
      chunk.match(/(?:₹|Rs\.?|INR)\s*(\d+(?:\.\d+)?)/i) ||
      chunk.match(/(?:benchmark|price|target|baseline)\s*(?:price)?\s*(?:of)?\s*(?:₹|Rs\.?|INR)?\s*(\d+(?:\.\d+)?)/i);
    const price = priceMatch ? parseFloat(priceMatch[1]).toFixed(2) : '35.00';

    // ── SKU Name ─────────────────────────────────────────────────────────────
    // Strip leading "Line NN <verb> the" then capture the first noun phrase
    let name = `Shipper Carton ${num}`;
    const stripped = stripLeadVerb(chunk)
      .replace(/\d+\s*[xX×]\s*\d+\s*[xX×]\s*\d+(?:\s*mm)?/gi, '') // remove dimensions
      .replace(/\d+\s*mm\s*[xX×]\s*\d+\s*m/gi, '')                  // remove tape roll dims like "72 mm x 50 m"
      .trim();

    // Match broader set of terminal noun types for protective items
    const nounPattern = isProtective
      ? /^([a-z0-9\-\s]+?(?:protector|pad|tape|roll|liner|insert|cushion|guard|separator|wrap|sheet|corner[- ]guard|edge[- ]protect\w*|fiberglass[\s\-]reinforced[a-z\s]*tape|honeycomb[a-z\s]*pad|kraft[a-z\s]*tape))/i
      : /^([a-z0-9\-\s]+?(?:shipper|carton|container|box|mailer|crate|master|secondary|pack|package|bundle))/i;


    const nameMatch = stripped.match(nounPattern);
    if (nameMatch) {
      name = nameMatch[1].trim()
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }

    items.push({
      id,
      rfx_id: 'RFX-2026-CORR',
      line_number: num,
      sku_name: name,
      spec_category: categoryForLine(num, input),
      dimensions,
      spec_weight_kg: weight,
      target_volume: volume,
      baseline_benchmark_price: price,
    });
  }

  return items;
}

/**
 * Dual-layer parser: tries Gemini AI first, falls back to deterministic regex.
 */
export async function parseLineItemsDualLayer(input: string): Promise<ParsedLineItem[]> {
  const geminiKey = process.env.GEMINI_API_KEY;

  if (geminiKey) {
    try {
      const systemPrompt = `You are an expert procurement spec extractor for corrugated packaging RFx line items.

CATEGORY TIER RULES (STRICTLY ENFORCE — these override any text-level category descriptions):
- Lines 01–10  → spec_category = "5-Ply Master"
- Lines 11–20  → spec_category = "3-Ply Universal"
- Lines 21–27  → spec_category = "Die-Cut Mailer"
- Lines 28–30  → spec_category = "Protective"

SKU NAME EXTRACTION RULES:
- Strip ALL lead verb phrases: "covers", "specifies", "encompasses", "accounts for", "targets", "establishes", "details", "allocates", "rounds out ... with", "designates", "introduces", "captures", "identifies", "describes", "defines", "closes", "finalizes", "provides", "offers", "presents", "represents", "completes", "addresses", "serves", "features", "delineates", "adds in", "slots in at", "positions itself", "marks out"
- After stripping the verb, also strip leading article "the" or "a" and leading dimensions pattern (e.g. "600x400x400 mm").
- The sku_name MUST be a clean noun phrase: e.g. "Heavy-Duty Export Master Shipper", "Standard E-commerce Dispatch Carton", "Edge Protector Strips", "Honeycomb Separator Pads", "Fiberglass-Reinforced Kraft Sealing Tape".
- NEVER include conversational verb phrases as part of the sku_name.

PROTECTIVE PACKAGING RULES (Lines 28–30):
- These items may NOT have box dimensions (LxWxH). Use "N/A" for dimensions if not a box.
- Volume unit may be "pieces", "pads", "rolls" — capture the correct integer.
- Weight may be per-piece/roll weight (often 0.05–0.30 kg).

Extract every line item into this exact JSON format:
{
  "line_items": [
    {
      "id": "PKG-001",
      "line_number": 1,
      "sku_name": "Heavy-Duty Export Master Shipper",
      "spec_category": "5-Ply Master",
      "dimensions": "600x400x400mm",
      "spec_weight_kg": "1.15",
      "target_volume": 100000,
      "baseline_benchmark_price": "45.00"
    }
  ]
}

RULES:
- id must be "PKG-XXX" with 3-digit zero-padded line_number.
- spec_weight_kg and baseline_benchmark_price are 2-decimal STRING numbers.
- dimensions for non-box protective items = "N/A".
- Return only valid JSON, no markdown fences.`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiKey}`;
      const aiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\nUser Input Text:\n"${input}"` }],
            },
          ],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.0 },
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (aiRes.ok) {
        const data = await aiRes.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed.line_items) && parsed.line_items.length > 0) {
            const mapped = parsed.line_items.map((item: any, idx: number) => {
              const lineNum: number = item.line_number || idx + 1;
              // Post-processing: enforce tier-based category regardless of model output
              const tierCategory = categoryForLine(lineNum, input);
              // Ensure dimensions string ends with 'mm' for box items; preserve 'N/A' for protective
              let dims: string = item.dimensions || (lineNum >= 28 ? 'N/A' : '500x350x300mm');
              if (dims !== 'N/A' && !dims.toLowerCase().endsWith('mm')) dims += 'mm';
              return {
                id: item.id || `PKG-${String(lineNum).padStart(3, '0')}`,
                rfx_id: 'RFX-2026-CORR',
                line_number: lineNum,
                sku_name: item.sku_name || `Shipper Carton ${lineNum}`,
                spec_category: tierCategory,
                dimensions: dims,
                spec_weight_kg: parseFloat(item.spec_weight_kg || (lineNum >= 28 ? '0.15' : '1.00')).toFixed(2),
                target_volume: parseInt(item.target_volume || (lineNum >= 28 ? '5000' : '50000'), 10),
                baseline_benchmark_price: parseFloat(item.baseline_benchmark_price || '35.00').toFixed(2),
              };
            });

            // ── Quality Guard: detect verb-phrase contamination in SKU names ────
            // If Gemini returned names like "Designates The Standard FMCG Carton", fall
            // through to the deterministic regex parser which strips verb phrases correctly.
            const VERB_CONTAMINATION_RE = /^(?:covers?|specifies?|encompasses?|accounts?\s+for|targets?|establishes?|details?|allocates?|rounds?\s+out|designates?|introduces?|captures?|identifies?|describes?|defines?|closes?|finalizes?|provides?|offers?|presents?|represents?|completes?|addresses?|serves?|features?|delineates?|outlines?|adds?\s*in?|slots?\s+in|positions?\s+(?:itself)?|marks?\s+out)\s+the?\s*/i;
            const contaminatedCount = mapped.filter((m: ParsedLineItem) => VERB_CONTAMINATION_RE.test(m.sku_name)).length;
            const contaminationRate = contaminatedCount / mapped.length;

            if (contaminationRate > 0.15) {
              // >15% names are verb-contaminated — Gemini output is unreliable, use regex
              console.warn(`[CatalogService] Gemini output quality check failed: ${contaminatedCount}/${mapped.length} SKU names contain verb phrases. Using regex fallback.`);
            } else {
              return mapped;
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('[CatalogService] Gemini AI parse failed, falling back to regex:', err.message);
    }
  }

  return parseLineItemsRegex(input);
}


/**
 * Atomically overwrites the database catalog with ONLY the provided line items.
 * Clears old quotes, re-normalizes vendor quotes for the active lines,
 * recalculates rfx_master total budget and volume, and updates CSV exports.
 */
export function overwriteCatalogWithLineItems(items: ParsedLineItem[]): {
  success: boolean;
  count: number;
  total_basket_volume: number;
  total_target_budget_inr: number;
  lines: ParsedLineItem[];
} {
  if (!items || items.length === 0) {
    throw new Error('Cannot overwrite catalog with zero line items');
  }

  const db = getDatabase();

  // 1. Calculate dynamic aggregates across active items
  const totalVolume = items.reduce((acc, item) => acc + item.target_volume, 0);
  const totalBudget = items.reduce(
    (acc, item) => acc + item.target_volume * parseFloat(item.baseline_benchmark_price),
    0
  );

  // 2. Load Mock Vendor Profiles
  const mockDir = fs.existsSync(path.join(__dirname, '../../mock_data'))
    ? path.join(__dirname, '../../mock_data')
    : path.join(process.cwd(), 'mock_data');

  const v1Data = JSON.parse(fs.readFileSync(path.join(mockDir, 'vendor_1_packaging_world.json'), 'utf-8'));
  const v2Data = JSON.parse(fs.readFileSync(path.join(mockDir, 'vendor_2_apex_cartons_ocr.json'), 'utf-8'));
  const v3Data = JSON.parse(fs.readFileSync(path.join(mockDir, 'vendor_3_national_paper_quote.json'), 'utf-8'));
  const v4Data = JSON.parse(fs.readFileSync(path.join(mockDir, 'vendor_4_global_pack_pdf.json'), 'utf-8'));
  const v5Data = JSON.parse(fs.readFileSync(path.join(mockDir, 'vendor_5_balaji_email.json'), 'utf-8'));

  // Vendor 1 tooling amortized across current active basket volume
  const V1_TOOLING_PLATE_FEE_INR = 25000.0;
  const v1AmortizedToolingPerBox = V1_TOOLING_PLATE_FEE_INR / totalVolume;
  const V5_FREIGHT_SURCHARGE_PCT = 0.04;
  const USD_PEG_RATE = 84.0;

  // 3. Execute atomic transaction in SQLite
  const transaction = db.transaction(() => {
    // Delete existing quotes and line items
    db.prepare('DELETE FROM vendor_line_quotes').run();
    db.prepare('DELETE FROM rfx_line_items').run();

    // Insert new line items
    const insertLine = db.prepare(`
      INSERT INTO rfx_line_items (
        id, rfx_id, line_number, sku_name, spec_category,
        dimensions, spec_weight_kg, target_volume, baseline_benchmark_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      insertLine.run(
        item.id,
        item.rfx_id,
        item.line_number,
        item.sku_name,
        item.spec_category,
        item.dimensions,
        item.spec_weight_kg,
        item.target_volume,
        item.baseline_benchmark_price
      );
    }

    // Update master RFx with dynamic budget & volume
    db.prepare(`
      UPDATE rfx_master
      SET total_target_budget = ?
      WHERE id = 'RFX-2026-CORR'
    `).run(totalBudget.toFixed(2));

    // Prepare quote insertion statement
    const insertQuote = db.prepare(`
      INSERT INTO vendor_line_quotes (
        id, rfx_line_item_id, vendor_id, is_quoted,
        raw_price_string, raw_numeric_value, raw_unit, raw_currency,
        canonical_unit, unit_conversion_factor, normalized_base_price_inr,
        freight_surcharge_pct, amortized_tooling_inr, payment_term_penalty_inr,
        true_landed_unit_cost, signal_confidence, spec_confidence,
        sanity_confidence, composite_certainty, financial_exposure,
        review_status, source_page_number, source_bounding_box,
        source_snippet_text
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?
      )
    `);

    // Normalize quotes for active items
    for (const item of items) {
      const specWeightKg = parseFloat(item.spec_weight_kg);
      const benchmarkPrice = parseFloat(item.baseline_benchmark_price);

      // Raw quote definitions for all 5 vendors
      // V1: Excel
      const v1Item = v1Data.tabs[0].items.find((i: any) => i.sku_id === item.id);
      const v1Rate = v1Item ? v1Item.raw_rate : benchmarkPrice * 0.96;
      const v1Cell = v1Item ? v1Item.cell_ref : `C${item.line_number + 4}`;

      // V2: Angled OCR
      const v2Item = v2Data.items.find((i: any) => i.sku_id === item.id);
      const v2Rate = v2Item ? v2Item.raw_rate : (benchmarkPrice * 0.98) * 100;
      const v2BBox = v2Item ? v2Item.bounding_box : { page: 1, x: 100, y: 150 + item.line_number * 20, width: 80, height: 18 };

      // V3: Partial Word (Quoted lines 01-20, incomplete for lines 21-27)
      // Guardrail 1: For lines 01-10, Vendor 3 has valid quoted rates, but ISO failure remains on vendor profile
      const v3Item = v3Data.items.find((i: any) => i.sku_id === item.id);
      const v3IsQuoted = v3Item ? v3Item.is_quoted : item.line_number <= 20;
      const v3Rate = v3Item ? v3Item.raw_rate : (v3IsQuoted ? benchmarkPrice * 0.94 : null);

      // V4: Foreign USD PDF
      const v4Item = v4Data.items.find((i: any) => i.sku_id === item.id);
      const v4Rate = v4Item ? v4Item.raw_rate : (benchmarkPrice * 0.92) / USD_PEG_RATE;
      const v4BBox = v4Item ? v4Item.bounding_box : { page: 1, x: 200, y: 100 + item.line_number * 20, width: 70, height: 16 };

      // V5: Raw Email String
      // Guardrail 2: Dynamic Normalization for Vendor 5 using newly extracted spec_weight_kg:
      // Landed Cost = (spec_weight_kg * 44.00) * 1.04
      const v5RatePerKg = 44.0;
      const v5NormalizedBase = specWeightKg * v5RatePerKg;
      const v5LandedCost = v5NormalizedBase * (1 + V5_FREIGHT_SURCHARGE_PCT);

      // Compute peer median for this line
      const preliminaryBids = [
        v1Rate,
        v2Rate / 100,
        v3IsQuoted && v3Rate ? v3Rate : null,
        v4Rate * USD_PEG_RATE,
        v5NormalizedBase,
      ].filter((b): b is number => b !== null && b > 0);

      const medianPeerBid = calculatePeerMedian(preliminaryBids);

      // 1. Insert VEND-01
      const v1Landed = v1Rate + v1AmortizedToolingPerBox;
      const v1Gov = evaluateGovernance(1.0, 1.0, v1Rate, medianPeerBid, item.target_volume, benchmarkPrice, totalBudget, true);
      insertQuote.run(
        `QUOTE-V1-${item.id}`,
        item.id,
        'VEND-01',
        1,
        `₹${v1Rate.toFixed(2)} / box`,
        v1Rate.toFixed(2),
        'per box',
        'INR',
        'per_box',
        '1.000000',
        v1Rate.toFixed(4),
        '0.0000',
        v1AmortizedToolingPerBox.toFixed(6),
        '0.0000',
        v1Landed.toFixed(4),
        1.0,
        1.0,
        v1Gov.sanityConfidence,
        v1Gov.compositeCertainty.toFixed(4),
        v1Gov.financialExposure,
        v1Gov.reviewStatus,
        1,
        null,
        `Tab "Line Item Rates", Cell ${v1Cell}: ₹${v1Rate.toFixed(2)}`
      );

      // 2. Insert VEND-02
      const v2Base = v2Rate / 100;
      const v2Gov = evaluateGovernance(0.92, 0.85, v2Base, medianPeerBid, item.target_volume, benchmarkPrice, totalBudget, true);
      insertQuote.run(
        `QUOTE-V2-${item.id}`,
        item.id,
        'VEND-02',
        1,
        `₹${v2Rate.toLocaleString()} / 100 pcs`,
        v2Rate.toFixed(2),
        'per 100 pcs',
        'INR',
        'per_box',
        '0.010000',
        v2Base.toFixed(4),
        '0.0000',
        '0.000000',
        '0.0000',
        v2Base.toFixed(4),
        0.92,
        0.85,
        v2Gov.sanityConfidence,
        v2Gov.compositeCertainty.toFixed(4),
        v2Gov.financialExposure,
        v2Gov.reviewStatus,
        v2BBox.page,
        JSON.stringify(v2BBox),
        `Item ${item.line_number}: ₹${v2Rate.toLocaleString()} / 100 pcs`
      );

      // 3. Insert VEND-03
      if (v3IsQuoted && v3Rate !== null) {
        const v3Gov = evaluateGovernance(0.95, 1.0, v3Rate, medianPeerBid, item.target_volume, benchmarkPrice, totalBudget, true);
        insertQuote.run(
          `QUOTE-V3-${item.id}`,
          item.id,
          'VEND-03',
          1,
          `₹${v3Rate.toFixed(2)} / box`,
          v3Rate.toFixed(2),
          'per box',
          'INR',
          'per_box',
          '1.000000',
          v3Rate.toFixed(4),
          '0.0000',
          '0.000000',
          '0.0000',
          v3Rate.toFixed(4),
          0.95,
          1.0,
          v3Gov.sanityConfidence,
          v3Gov.compositeCertainty.toFixed(4),
          v3Gov.financialExposure,
          v3Gov.reviewStatus,
          1,
          null,
          `Document Section 3.1: ₹${v3Rate.toFixed(2)} / box`
        );
      } else {
        insertQuote.run(
          `QUOTE-V3-${item.id}`,
          item.id,
          'VEND-03',
          0,
          'NOT QUOTED',
          null,
          null,
          'INR',
          'per_box',
          '1.000000',
          null,
          '0.0000',
          '0.000000',
          '0.0000',
          null,
          0.0,
          0.0,
          0.0,
          '0.0000',
          'LOW',
          'EXCLUDED',
          1,
          null,
          'Bid omitted in quotation document'
        );
      }

      // 4. Insert VEND-04
      const v4BaseInr = v4Rate * USD_PEG_RATE;
      const v4Gov = evaluateGovernance(0.98, 1.0, v4BaseInr, medianPeerBid, item.target_volume, benchmarkPrice, totalBudget, true);
      insertQuote.run(
        `QUOTE-V4-${item.id}`,
        item.id,
        'VEND-04',
        1,
        `$${v4Rate.toFixed(4)} / box`,
        v4Rate.toFixed(4),
        'per box',
        'USD',
        'per_box',
        '1.000000',
        v4BaseInr.toFixed(4),
        '0.0000',
        '0.000000',
        '0.0000',
        v4BaseInr.toFixed(4),
        0.98,
        1.0,
        v4Gov.sanityConfidence,
        v4Gov.compositeCertainty.toFixed(4),
        v4Gov.financialExposure,
        v4Gov.reviewStatus,
        v4BBox.page,
        JSON.stringify(v4BBox),
        `Commercial Proposal Page ${v4BBox.page}: $${v4Rate.toFixed(4)} / box`
      );

      // 5. Insert VEND-05 (Balaji Traders)
      // Guardrail 2 enforced:
      // Normalized Base = spec_weight_kg * 44.00
      // Landed Cost = (spec_weight_kg * 44.00) * 1.04
      const v5Gov = evaluateGovernance(0.88, 0.65, v5NormalizedBase, medianPeerBid, item.target_volume, benchmarkPrice, totalBudget, true);
      insertQuote.run(
        `QUOTE-V5-${item.id}`,
        item.id,
        'VEND-05',
        1,
        `₹${v5RatePerKg.toFixed(2)} / kg`,
        v5RatePerKg.toFixed(2),
        'per kg',
        'INR',
        'per_box',
        specWeightKg.toFixed(6),
        v5NormalizedBase.toFixed(4),
        V5_FREIGHT_SURCHARGE_PCT.toFixed(4),
        '0.000000',
        '0.0000',
        v5LandedCost.toFixed(4),
        0.88,
        0.65,
        v5Gov.sanityConfidence,
        v5Gov.compositeCertainty.toFixed(4),
        v5Gov.financialExposure,
        v5Gov.reviewStatus,
        1,
        null,
        `Email clause: "All 5-ply cartons @ Rs 44/kg base" (+4% freight extra)`
      );
    }
  });

  transaction();

  // Export updated CSVs
  exportAllTables();

  return {
    success: true,
    count: items.length,
    total_basket_volume: totalVolume,
    total_target_budget_inr: totalBudget,
    lines: items,
  };
}

/**
 * Restores the canonical 30 line items and standard quotes.
 */
export function restoreCanonicalCatalog(): {
  success: boolean;
  count: number;
  total_basket_volume: number;
  total_target_budget_inr: number;
} {
  const db = getDatabase();

  const resetTransaction = db.transaction(() => {
    db.prepare('DELETE FROM vendor_line_quotes').run();
    db.prepare('DELETE FROM rfx_line_items').run();

    const insertLine = db.prepare(`
      INSERT INTO rfx_line_items (
        id, rfx_id, line_number, sku_name, spec_category,
        dimensions, spec_weight_kg, target_volume, baseline_benchmark_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of CANONICAL_LINE_ITEMS) {
      insertLine.run(
        item.id,
        item.rfx_id,
        item.line_number,
        item.sku_name,
        item.spec_category,
        item.dimensions,
        item.spec_weight_kg,
        item.target_volume,
        item.baseline_benchmark_price
      );
    }

    db.prepare(`
      UPDATE rfx_master
      SET total_target_budget = ?
      WHERE id = 'RFX-2026-CORR'
    `).run(MASTER_RFX.total_target_budget);
  });

  resetTransaction();

  // Re-run standard ingestion pipeline
  runIngestionPipeline();

  // Export CSVs
  exportAllTables();

  const lineItems = db.prepare('SELECT * FROM rfx_line_items').all() as any[];
  const totalVolume = lineItems.reduce((acc, i) => acc + i.target_volume, 0);
  const master = db.prepare('SELECT total_target_budget FROM rfx_master WHERE id = ?').get('RFX-2026-CORR') as any;

  return {
    success: true,
    count: lineItems.length,
    total_basket_volume: totalVolume,
    total_target_budget_inr: parseFloat(master.total_target_budget),
  };
}
