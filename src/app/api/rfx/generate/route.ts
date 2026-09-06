import { NextResponse } from 'next/server';

interface RfxSpecification {
  rfx_id: string;
  title: string;
  category: string;
  baseline_currency: string;
  total_target_budget_inr: number;
  usd_peg_rate: number;
  total_basket_volume: number;
  payment_terms: string;
  questionnaire_criteria: {
    id: string;
    name: string;
    mandatory: boolean;
    description: string;
  }[];
  spec_categories: {
    category: string;
    lines_count: number;
    target_volume: number;
    description: string;
  }[];
  line_items_preview: {
    sku_id: string;
    sku_name: string;
    category: string;
    dimensions: string;
    volume: number;
    benchmark_rate: number;
  }[];
  generated_via: 'GEMINI_AI' | 'DETERMINISTIC_CATALOG';
}

const DEFAULT_SPEC: RfxSpecification = {
  rfx_id: 'RFX-2026-CORR',
  title: 'Annual Rate Contract - Corrugated Packaging FY26',
  category: 'Corrugated Packaging',
  baseline_currency: 'INR',
  total_target_budget_inr: 40000000.0, // ₹4.00 Cr
  usd_peg_rate: 84.0,
  total_basket_volume: 1458000, // 1.458M units
  payment_terms: 'Net 60',
  questionnaire_criteria: [
    {
      id: 'Q-ISO-9001',
      name: 'ISO 9001:2015 Quality Management Gate',
      mandatory: true,
      description: 'Mandatory quality gate: suppliers must possess active ISO certification and score >= 70.00% on site audit.',
    },
    {
      id: 'Q-FSC-COC',
      name: 'FSC Chain of Custody Certification',
      mandatory: false,
      description: 'Preference for suppliers with certified sustainable recycled kraft supply chain provenance.',
    },
    {
      id: 'Q-ESG-COMP',
      name: 'ESG & Labour Standards Audit',
      mandatory: false,
      description: 'Annual statutory labor compliance certificate and zero child-labour declaration.',
    },
  ],
  spec_categories: [
    {
      category: '5-Ply Master',
      lines_count: 10,
      target_volume: 460000,
      description: 'Heavy-duty export & master distribution cartons (PKG-001 to PKG-010).',
    },
    {
      category: '3-Ply Universal',
      lines_count: 10,
      target_volume: 620000,
      description: 'Secondary retail packaging & general dispatch boxes (PKG-011 to PKG-020).',
    },
    {
      category: 'Die-Cut Mailer',
      lines_count: 7,
      target_volume: 275000,
      description: 'Self-locking e-commerce subscription mailers (PKG-021 to PKG-027).',
    },
    {
      category: 'Protective',
      lines_count: 3,
      target_volume: 103000,
      description: 'Edge protectors, honeycomb buffer sheets, and reinforced tape (PKG-028 to PKG-030).',
    },
  ],
  line_items_preview: [
    { sku_id: 'PKG-001', sku_name: 'Heavy Duty Master Shipper A', category: '5-Ply Master', dimensions: '600x400x400mm', volume: 50000, benchmark_rate: 45.0 },
    { sku_id: 'PKG-002', sku_name: 'Heavy Duty Master Shipper B', category: '5-Ply Master', dimensions: '500x350x300mm', volume: 45000, benchmark_rate: 38.5 },
    { sku_id: 'PKG-011', sku_name: 'Standard Universal Carton 1', category: '3-Ply Universal', dimensions: '300x250x200mm', volume: 80000, benchmark_rate: 22.0 },
    { sku_id: 'PKG-021', sku_name: 'E-Commerce Mailer Small', category: 'Die-Cut Mailer', dimensions: '250x150x100mm', volume: 60000, benchmark_rate: 16.0 },
    { sku_id: 'PKG-028', sku_name: 'V-Profile Edge Protector 50x50x1000mm', category: 'Protective', dimensions: '50x50x1000mm', volume: 45000, benchmark_rate: 15.0 },
  ],
  generated_via: 'DETERMINISTIC_CATALOG',
};

import { parseLineItemsDualLayer, overwriteCatalogWithLineItems } from '@/lib/catalogService';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const prompt = (body.prompt || '').trim();
    const applyToMatrix = Boolean(body.apply_to_matrix);

    if (!prompt) {
      return NextResponse.json(
        { error: 'Buyer prompt is required to generate RFx specification' },
        { status: 400 }
      );
    }

    // 1. Check if the prompt defines custom line items
    const parsedLineItems = await parseLineItemsDualLayer(prompt);
    const hasCustomLines = parsedLineItems.length > 0;

    let totalVolume = DEFAULT_SPEC.total_basket_volume;
    let totalBudget = DEFAULT_SPEC.total_target_budget_inr;
    let specCategories = DEFAULT_SPEC.spec_categories;
    let lineItemsPreview = DEFAULT_SPEC.line_items_preview;

    if (hasCustomLines) {
      totalVolume = parsedLineItems.reduce((acc, l) => acc + l.target_volume, 0);
      totalBudget = parsedLineItems.reduce(
        (acc, l) => acc + l.target_volume * parseFloat(l.baseline_benchmark_price),
        0
      );

      // Group categories
      const catMap = new Map<string, { count: number; volume: number }>();
      for (const l of parsedLineItems) {
        const cat = l.spec_category || '5-Ply Master';
        const existing = catMap.get(cat) || { count: 0, volume: 0 };
        catMap.set(cat, {
          count: existing.count + 1,
          volume: existing.volume + l.target_volume,
        });
      }

      specCategories = Array.from(catMap.entries()).map(([cat, val]) => ({
        category: cat,
        lines_count: val.count,
        target_volume: val.volume,
        description: `${val.count} custom specified packaging lines.`,
      }));

      lineItemsPreview = parsedLineItems.map((l) => ({
        sku_id: l.id,
        sku_name: l.sku_name,
        category: l.spec_category,
        dimensions: l.dimensions,
        volume: l.target_volume,
        benchmark_rate: parseFloat(l.baseline_benchmark_price),
      }));

      if (applyToMatrix) {
        overwriteCatalogWithLineItems(parsedLineItems);
      }
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    let title = hasCustomLines
      ? `Custom Corrugated Packaging RFx (${parsedLineItems.length} SKUs)`
      : DEFAULT_SPEC.title;
    let paymentTerms = DEFAULT_SPEC.payment_terms;
    let generatedVia: 'GEMINI_AI' | 'DETERMINISTIC_CATALOG' = 'DETERMINISTIC_CATALOG';

    if (geminiKey) {
      try {
        const systemPrompt = `You are the Aerchain Category Procurement RFx Authoring Agent.
Analyze the buyer natural language requirements and refine or extract key RFx terms.
Return strictly a JSON object conforming to this schema:
{
  "title": string,
  "category": string,
  "payment_terms": string,
  "notes": string
}`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${geminiKey}`;
        const aiRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nBuyer Prompt: "${prompt}"` }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (aiRes.ok) {
          const data = await aiRes.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text);
            if (parsed.title) title = parsed.title;
            if (parsed.payment_terms) paymentTerms = parsed.payment_terms;
            generatedVia = 'GEMINI_AI';
          }
        }
      } catch (err: any) {
        console.warn('[RFx Generate] Gemini AI error, using extracted specs:', err?.message || err);
      }
    }

    return NextResponse.json({
      success: true,
      specification: {
        ...DEFAULT_SPEC,
        title,
        payment_terms: paymentTerms,
        total_target_budget_inr: totalBudget,
        total_basket_volume: totalVolume,
        spec_categories: specCategories,
        line_items_preview: lineItemsPreview,
        custom_lines_count: hasCustomLines ? parsedLineItems.length : null,
        generated_via: generatedVia,
      },
      parsed_line_items: hasCustomLines ? parsedLineItems : null,
      prompt_analyzed: prompt,
    });
  } catch (err: any) {
    console.error('[RFx Generate] Route error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to generate RFx specification' },
      { status: 500 }
    );
  }
}
