import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDatabase();

    // 1. Fetch Master RFx Metadata
    const master = db
      .prepare('SELECT * FROM rfx_master WHERE id = ?')
      .get('RFX-2026-CORR') as any;

    if (!master) {
      return NextResponse.json(
        { error: 'Master RFx RFX-2026-CORR not found.' },
        { status: 404 }
      );
    }

    // 2. Fetch Vendors
    const vendors = db
      .prepare('SELECT * FROM vendors ORDER BY id ASC')
      .all() as any[];

    // 3. Fetch Line Items
    const lineItems = db
      .prepare('SELECT * FROM rfx_line_items ORDER BY line_number ASC')
      .all() as any[];

    // 4. Fetch All Quotes
    const quotes = db
      .prepare('SELECT * FROM vendor_line_quotes ORDER BY rfx_line_item_id ASC, vendor_id ASC')
      .all() as any[];

    // Index quotes by line_item_id -> vendor_id
    const quotesMap = new Map<string, Map<string, any>>();
    for (const q of quotes) {
      if (!quotesMap.has(q.rfx_line_item_id)) {
        quotesMap.set(q.rfx_line_item_id, new Map());
      }
      quotesMap.get(q.rfx_line_item_id)!.set(q.vendor_id, q);
    }

    // Counters for governance summary
    let autoVerifiedCount = 0;
    let mandatoryReviewCount = 0;
    let buyerConfirmedCount = 0;
    let excludedCount = 0;

    // 5. Build Unified Matrix Rows
    const lines = lineItems.map((item) => {
      const lineQuotesMap = quotesMap.get(item.id) || new Map();
      const vendorQuotes: Record<string, any> = {};

      for (const vendor of vendors) {
        const q = lineQuotesMap.get(vendor.id);

        if (!q || q.is_quoted === 0) {
          excludedCount++;
          // CRITICAL GUARDRAIL: Strict representation for unquoted/missing lines
          vendorQuotes[vendor.id] = {
            quote_id: q?.id ?? `QUOTE-${vendor.id}-${item.id}`,
            vendor_id: vendor.id,
            is_quoted: false,
            raw_display: 'NOT QUOTED',
            raw_numeric_value: null,
            raw_unit: null,
            raw_currency: 'INR',
            normalized_base_inr: null,
            landed_cost_inr: null,
            has_footnotes: false,
            footnote_detail: null,
            review_status: 'EXCLUDED',
            certainty_score: 0.0,
            surcharge_chips: [],
          };
          continue;
        }

        // Tally review status
        if (q.review_status === 'MANDATORY_BUYER_REVIEW') {
          mandatoryReviewCount++;
        } else if (q.review_status === 'BUYER_CONFIRMED') {
          buyerConfirmedCount++;
        } else if (q.review_status === 'AUTO_VERIFIED') {
          autoVerifiedCount++;
        }

        const landedCostNum = q.true_landed_unit_cost !== null ? parseFloat(q.true_landed_unit_cost) : null;
        const normalizedBaseNum = q.normalized_base_price_inr !== null ? parseFloat(q.normalized_base_price_inr) : null;
        const certaintyNum = parseFloat(q.composite_certainty);

        // Derive surcharge chips and footnote details
        const surchargeChips: { type: string; label: string }[] = [];
        let footnoteDetail: string | null = null;
        let hasFootnotes = false;

        const amortizedTooling = parseFloat(q.amortized_tooling_inr || '0');
        const freightPct = parseFloat(q.freight_surcharge_pct || '0');

        if (amortizedTooling > 0) {
          hasFootnotes = true;
          footnoteDetail = `Tooling plate fee amortized (+₹${amortizedTooling.toFixed(3)}/box)`;
          surchargeChips.push({
            type: 'TOOLING',
            label: `+₹${amortizedTooling.toFixed(3)} Tooling`,
          });
        }

        if (freightPct > 0) {
          hasFootnotes = true;
          const freightText = `+${(freightPct * 100).toFixed(0)}% freight surcharge`;
          footnoteDetail = footnoteDetail ? `${footnoteDetail}; ${freightText}` : freightText;
          surchargeChips.push({
            type: 'FREIGHT',
            label: `+${(freightPct * 100).toFixed(0)}% Freight`,
          });
        }

        if (q.raw_currency === 'USD') {
          hasFootnotes = true;
          const fxText = `Converted @ ${parseFloat(master.usd_peg_rate).toFixed(2)} INR/USD peg`;
          footnoteDetail = footnoteDetail ? `${footnoteDetail}; ${fxText}` : fxText;
          surchargeChips.push({
            type: 'FX_PEG',
            label: `Peg @ ${parseFloat(master.usd_peg_rate).toFixed(2)}`,
          });
        }

        if (q.raw_unit === 'per 100 pcs') {
          surchargeChips.push({
            type: 'UNIT_SCALE',
            label: '/100 pcs scaled',
          });
        } else if (q.raw_unit === 'per kg') {
          surchargeChips.push({
            type: 'DERIVED_WEIGHT',
            label: `${parseFloat(item.spec_weight_kg).toFixed(2)}kg derived`,
          });
        }

        vendorQuotes[vendor.id] = {
          quote_id: q.id,
          vendor_id: vendor.id,
          is_quoted: true,
          raw_display: q.raw_price_string,
          raw_numeric_value: q.raw_numeric_value ? parseFloat(q.raw_numeric_value) : null,
          raw_unit: q.raw_unit,
          raw_currency: q.raw_currency,
          normalized_base_inr: normalizedBaseNum,
          landed_cost_inr: landedCostNum,
          has_footnotes: hasFootnotes,
          footnote_detail: footnoteDetail,
          review_status: q.review_status,
          certainty_score: certaintyNum,
          financial_exposure: q.financial_exposure,
          flag_reason:
            q.review_status === 'MANDATORY_BUYER_REVIEW'
              ? `${q.financial_exposure} Spend item with Certainty ${certaintyNum.toFixed(3)} (< 0.90)`
              : null,
          surcharge_chips: surchargeChips,
          source_bounding_box: q.source_bounding_box ? JSON.parse(q.source_bounding_box) : null,
        };
      }

      return {
        line_id: item.id,
        line_number: item.line_number,
        sku_name: item.sku_name,
        spec_category: item.spec_category,
        dimensions: item.dimensions,
        spec_weight_kg: parseFloat(item.spec_weight_kg),
        target_volume: item.target_volume,
        baseline_benchmark_price: parseFloat(item.baseline_benchmark_price),
        quotes: vendorQuotes,
      };
    });

    const responsePayload = {
      rfx_id: master.id,
      title: master.title,
      category: master.category,
      baseline_currency: master.baseline_currency,
      usd_peg_rate: parseFloat(master.usd_peg_rate),
      total_budget_inr: parseFloat(master.total_target_budget),
      vendor_count: vendors.length,
      vendors: vendors.map((v) => ({
        id: v.id,
        name: v.name,
        inbound_modality: v.inbound_modality,
        iso_9001_certified: Boolean(v.iso_9001_certified),
        fsc_certified: Boolean(v.fsc_certified),
        credit_terms: v.credit_terms,
        quality_audit_score: parseFloat(v.quality_audit_score),
      })),
      lines,
      review_summary: {
        total_quotes: quotes.length,
        auto_verified: autoVerifiedCount,
        mandatory_buyer_review: mandatoryReviewCount,
        buyer_confirmed: buyerConfirmedCount,
        excluded: excludedCount,
      },
    };

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error: any) {
    console.error('Failed in GET /api/matrix:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
