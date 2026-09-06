import { NextResponse } from 'next/server';
import path from 'path';
import { getDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const params = await props.params;
    const quoteId = params.id;

    if (!quoteId) {
      return NextResponse.json({ error: 'Quote ID is required.' }, { status: 400 });
    }

    const db = getDatabase();

    const record = db
      .prepare(`
        SELECT 
          q.*,
          i.sku_name,
          i.spec_category,
          i.dimensions,
          i.spec_weight_kg,
          i.target_volume,
          i.baseline_benchmark_price,
          v.name as vendor_name,
          v.raw_document_url,
          v.doc_sha256,
          v.inbound_modality,
          m.usd_peg_rate,
          m.total_target_budget
        FROM vendor_line_quotes q
        JOIN rfx_line_items i ON q.rfx_line_item_id = i.id
        JOIN vendors v ON q.vendor_id = v.id
        JOIN rfx_master m ON i.rfx_id = m.id
        WHERE q.id = ?
      `)
      .get(quoteId) as any;

    if (!record) {
      return NextResponse.json(
        { error: `Quote with ID '${quoteId}' not found.` },
        { status: 404 }
      );
    }

    // Parse Bounding Box if present
    let boundingBox = null;
    if (record.source_bounding_box) {
      try {
        boundingBox = JSON.parse(record.source_bounding_box);
      } catch {
        boundingBox = null;
      }
    }

    // Construct Zero-Hallucination Rule-Based Audit Trail
    const auditTrail: string[] = [];

    if (record.is_quoted === 0) {
      auditTrail.push('Status: Supplier explicitly omitted quote for this item in submitted rate card.');
      auditTrail.push('Compliance rule: Line excluded from award allocation considerations.');
    } else {
      // Step 1: Raw Input
      auditTrail.push(`Raw input detected: ${record.raw_price_string} (${record.raw_currency})`);

      // Step 2: Unit Rule
      if (record.raw_unit === 'per 100 pcs') {
        auditTrail.push(`Rule applied: UNIT_SCALE (Factor: ${record.unit_conversion_factor} -> scaled / 100.0)`);
      } else if (record.raw_unit === 'per kg') {
        auditTrail.push(
          `Rule applied: DIMENSIONAL_WEIGHT (Rate: ₹${record.raw_numeric_value}/kg * nominal box weight ${record.spec_weight_kg} kg)`
        );
      } else {
        auditTrail.push(`Rule applied: DIRECT_UNIT (Factor: ${record.unit_conversion_factor} -> 1:1 single box match)`);
      }

      // Step 3: Base Rate
      auditTrail.push(`Normalized base rate: ₹${record.normalized_base_price_inr} per box`);

      // Step 4: Currency Conversion
      if (record.raw_currency === 'USD') {
        auditTrail.push(
          `Currency conversion: Converted @ fixed peg ₹${parseFloat(record.usd_peg_rate).toFixed(4)} INR/USD`
        );
      } else {
        auditTrail.push(`Currency verification: Baseline INR (no FX peg adjustment required)`);
      }

      // Step 5: Ancillary Additions
      const amortizedTooling = parseFloat(record.amortized_tooling_inr || '0');
      const freightPct = parseFloat(record.freight_surcharge_pct || '0');
      const basePriceInr = parseFloat(record.normalized_base_price_inr || '0');

      if (amortizedTooling > 0) {
        auditTrail.push(
          `Ancillary fee applied: Tooling plate fee amortized (+₹${amortizedTooling.toFixed(6)}/box across contract volume)`
        );
      }

      if (freightPct > 0) {
        const freightAmount = basePriceInr * freightPct;
        auditTrail.push(
          `Ancillary fee applied: Freight surcharge (+${(freightPct * 100).toFixed(2)}% = +₹${freightAmount.toFixed(6)}/box)`
        );
      }

      if (amortizedTooling === 0 && freightPct === 0) {
        auditTrail.push('Ancillary check: No freight surcharges or tooling plate fees detected for this line');
      }

      // Step 6: Final True Landed Unit Cost
      auditTrail.push(`True Landed Unit Cost: ₹${record.true_landed_unit_cost} / box`);
    }

    const payload = {
      quote_id: record.id,
      rfx_line_item_id: record.rfx_line_item_id,
      line_number: record.line_number,
      sku_name: record.sku_name,
      spec_category: record.spec_category,
      dimensions: record.dimensions,
      spec_weight_kg: parseFloat(record.spec_weight_kg),
      target_volume: record.target_volume,
      vendor_id: record.vendor_id,
      vendor_name: record.vendor_name,
      inbound_modality: record.inbound_modality,
      document_name: path.basename(record.raw_document_url),
      document_url: record.raw_document_url,
      document_sha256: record.doc_sha256,
      bounding_box: boundingBox,
      raw_ocr_transcript: record.source_snippet_text,
      conversion_audit_trail: auditTrail,
      certainty_metrics: {
        signal_confidence: parseFloat(record.signal_confidence),
        sanity_confidence: parseFloat(record.sanity_confidence),
        spec_confidence: parseFloat(record.spec_confidence),
        composite_certainty: parseFloat(record.composite_certainty),
      },
      financial_exposure: record.financial_exposure,
      review_status: record.review_status,
      is_confirmed_by_buyer: record.review_status === 'BUYER_CONFIRMED',
      human_override_reason: record.human_override_reason,
      reviewed_at: record.reviewed_at,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (error: any) {
    console.error('Failed in GET /api/quotes/:id/provenance:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
