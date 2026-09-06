import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

export interface ConfirmRequestBody {
  confirmed_rate_inr?: number;
  override_reason?: string;
}

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const params = await props.params;
    const quoteId = params.id;

    if (!quoteId) {
      return NextResponse.json({ error: 'Quote ID is required.' }, { status: 400 });
    }

    let body: ConfirmRequestBody = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is acceptable for standard confirmation sign-off
    }

    const db = getDatabase();

    const quote = db
      .prepare('SELECT * FROM vendor_line_quotes WHERE id = ?')
      .get(quoteId) as any;

    if (!quote) {
      return NextResponse.json(
        { error: `Quote with ID '${quoteId}' not found.` },
        { status: 404 }
      );
    }

    const previousStatus = quote.review_status;
    let newNormalizedBase = quote.normalized_base_price_inr;
    let newLandedCost = quote.true_landed_unit_cost;
    const freightPct = parseFloat(quote.freight_surcharge_pct || '0');
    const amortizedTooling = parseFloat(quote.amortized_tooling_inr || '0');

    // CRITICAL GUARDRAIL: Atomic Recalculation on Manual Rate Override
    if (body.confirmed_rate_inr !== undefined && body.confirmed_rate_inr !== null) {
      const rateNum = Number(body.confirmed_rate_inr);
      if (isNaN(rateNum) || rateNum <= 0) {
        return NextResponse.json(
          { error: 'confirmed_rate_inr must be a positive numeric value.' },
          { status: 400 }
        );
      }

      // Re-apply deterministic ancillary formula: (confirmed_rate * (1 + freight)) + tooling
      const calculatedLanded = rateNum * (1 + freightPct) + amortizedTooling;

      newNormalizedBase = rateNum.toFixed(6);
      newLandedCost = calculatedLanded.toFixed(6);
    }

    const overrideReason =
      body.override_reason?.trim() ||
      (body.confirmed_rate_inr !== undefined
        ? `Buyer adjusted base rate to ₹${Number(body.confirmed_rate_inr).toFixed(2)} and confirmed extraction.`
        : 'Buyer verified and signed off on extraction.');

    const nowIso = new Date().toISOString();

    // Execute atomic update in SQLite
    db.prepare(`
      UPDATE vendor_line_quotes
      SET 
        normalized_base_price_inr = ?,
        true_landed_unit_cost = ?,
        review_status = 'BUYER_CONFIRMED',
        human_override_reason = ?,
        reviewed_at = ?
      WHERE id = ?
    `).run(newNormalizedBase, newLandedCost, overrideReason, nowIso, quoteId);

    const updatedRecord = db
      .prepare('SELECT * FROM vendor_line_quotes WHERE id = ?')
      .get(quoteId) as any;

    return NextResponse.json(
      {
        success: true,
        quote_id: updatedRecord.id,
        rfx_line_item_id: updatedRecord.rfx_line_item_id,
        vendor_id: updatedRecord.vendor_id,
        previous_status: previousStatus,
        new_status: updatedRecord.review_status,
        normalized_base_price_inr: parseFloat(updatedRecord.normalized_base_price_inr),
        true_landed_unit_cost: parseFloat(updatedRecord.true_landed_unit_cost),
        human_override_reason: updatedRecord.human_override_reason,
        reviewed_at: updatedRecord.reviewed_at,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Failed in POST /api/quotes/:id/confirm:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
