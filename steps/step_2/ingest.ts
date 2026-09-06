import fs from 'fs';
import path from 'path';
import { getDatabase, closeDatabase } from '../../src/lib/db';
import {
  RawQuoteInput,
  LineSpecContext,
  NormalizedQuoteOutput,
  normalizeQuote,
  calculatePeerMedian,
  calculateUnitConversion,
  convertCurrencyToInr,
} from './normalizationEngine';
import { exportAllTables } from '../../scripts/export_csv';

export function runIngestionPipeline(): void {
  const db = getDatabase();
  console.log('🚀 Starting Aerchain Multi-Modal Ingestion & Normalization Pipeline...\n');

  // 1. Fetch Master RFx Metadata
  const master = db.prepare('SELECT * FROM rfx_master WHERE id = ?').get('RFX-2026-CORR') as any;
  if (!master) {
    throw new Error('Master RFx RFX-2026-CORR not found! Run npm run db:seed first.');
  }

  const usdPegRate = parseFloat(master.usd_peg_rate); // 84.0000
  const totalBudget = parseFloat(master.total_target_budget); // 40000000.00

  // 2. Fetch Canonical Line Items
  const lineItems = db.prepare('SELECT * FROM rfx_line_items ORDER BY line_number ASC').all() as any[];
  if (lineItems.length === 0) {
    throw new Error('No line items found in catalog');
  }

  // Calculate explicit denominator for basket tooling amortization
  // Sum of all 30 target volumes: 1,458,000 units
  const BASKET_TOTAL_VOLUME = lineItems.reduce((acc, item) => acc + item.target_volume, 0);
  console.log(`📊 Catalog Context:`);
  console.log(`   - Master RFx: ${master.id} (Budget: ₹${(totalBudget / 10000000).toFixed(2)} Cr)`);
  console.log(`   - Total Target Basket Volume: ${BASKET_TOTAL_VOLUME.toLocaleString()} units`);
  console.log(`   - USD Fixed Peg: ₹${usdPegRate.toFixed(4)}/$\n`);

  // Define Vendor Ancillary Fees
  // Vendor 1: ₹25,000 one-time tooling fee amortized across total basket volume
  const V1_TOOLING_PLATE_FEE_INR = 25000.0;
  const V1_AMORTIZED_TOOLING_PER_BOX = V1_TOOLING_PLATE_FEE_INR / BASKET_TOTAL_VOLUME; // ≈ 0.017147 INR/box

  // Vendor 5: 4% freight surcharge on invoice
  const V5_FREIGHT_SURCHARGE_PCT = 0.0400; // 4.00%

  console.log(`💼 Ancillary Terms:`);
  console.log(`   - VEND-01 Amortized Tooling: ₹${V1_AMORTIZED_TOOLING_PER_BOX.toFixed(6)}/box (₹25,000 / ${BASKET_TOTAL_VOLUME.toLocaleString()} units)`);
  console.log(`   - VEND-05 Freight Surcharge: ${(V5_FREIGHT_SURCHARGE_PCT * 100).toFixed(2)}% on invoice\n`);

  // 3. Load 5 Mock Vendor Files
  const mockDir = fs.existsSync(path.join(__dirname, 'mock_data'))
    ? path.join(__dirname, 'mock_data')
    : path.join(process.cwd(), 'mock_data');
  const v1Data = JSON.parse(fs.readFileSync(path.join(mockDir, 'vendor_1_packaging_world.json'), 'utf-8'));
  const v2Data = JSON.parse(fs.readFileSync(path.join(mockDir, 'vendor_2_apex_cartons_ocr.json'), 'utf-8'));
  const v3Data = JSON.parse(fs.readFileSync(path.join(mockDir, 'vendor_3_national_paper_quote.json'), 'utf-8'));
  const v4Data = JSON.parse(fs.readFileSync(path.join(mockDir, 'vendor_4_global_pack_pdf.json'), 'utf-8'));
  const v5Data = JSON.parse(fs.readFileSync(path.join(mockDir, 'vendor_5_balaji_email.json'), 'utf-8'));

  // 4. Transform Raw Mock Inputs into Normalized Intermediate Structure
  const rawQuotesByLine: Map<string, RawQuoteInput[]> = new Map();
  for (const item of lineItems) {
    rawQuotesByLine.set(item.id, []);
  }

  // --- Process VEND-01 (Excel) ---
  for (const vItem of v1Data.tabs[0].items) {
    rawQuotesByLine.get(vItem.sku_id)?.push({
      line_item_id: vItem.sku_id,
      vendor_id: 'VEND-01',
      is_quoted: true,
      raw_price_string: `₹${vItem.raw_rate.toFixed(2)} / box`,
      raw_numeric_value: vItem.raw_rate,
      raw_unit: vItem.raw_unit,
      raw_currency: 'INR',
      modality: 'MULTI_TAB_EXCEL',
      source_page_number: 1,
      source_snippet_text: `Tab "Line Item Rates", Cell ${vItem.cell_ref}: ₹${vItem.raw_rate.toFixed(2)}`,
    });
  }

  // --- Process VEND-02 (Angled Photo OCR) ---
  for (const vItem of v2Data.items) {
    rawQuotesByLine.get(vItem.sku_id)?.push({
      line_item_id: vItem.sku_id,
      vendor_id: 'VEND-02',
      is_quoted: true,
      raw_price_string: `₹${vItem.raw_rate.toLocaleString()} / 100 pcs`,
      raw_numeric_value: vItem.raw_rate,
      raw_unit: vItem.raw_unit,
      raw_currency: 'INR',
      modality: 'ANGLED_PHOTO',
      source_page_number: vItem.bounding_box.page,
      source_bounding_box: vItem.bounding_box,
      source_snippet_text: vItem.raw_string,
    });
  }

  // --- Process VEND-03 (Partial Word) ---
  for (const vItem of v3Data.items) {
    rawQuotesByLine.get(vItem.sku_id)?.push({
      line_item_id: vItem.sku_id,
      vendor_id: 'VEND-03',
      is_quoted: vItem.is_quoted,
      raw_price_string: vItem.is_quoted ? `₹${vItem.raw_rate.toFixed(2)} / box` : 'NOT QUOTED',
      raw_numeric_value: vItem.is_quoted ? vItem.raw_rate : null,
      raw_unit: vItem.is_quoted ? vItem.raw_unit : null,
      raw_currency: 'INR',
      modality: 'PARTIAL_WORD',
      source_page_number: 1,
      source_snippet_text: vItem.raw_string,
    });
  }

  // --- Process VEND-04 (Foreign USD PDF) ---
  for (const vItem of v4Data.items) {
    rawQuotesByLine.get(vItem.sku_id)?.push({
      line_item_id: vItem.sku_id,
      vendor_id: 'VEND-04',
      is_quoted: true,
      raw_price_string: `$${vItem.raw_rate.toFixed(4)} / box`,
      raw_numeric_value: vItem.raw_rate,
      raw_unit: vItem.raw_unit,
      raw_currency: 'USD',
      modality: 'FOREIGN_USD_PDF',
      source_page_number: vItem.bounding_box.page,
      source_bounding_box: vItem.bounding_box,
      source_snippet_text: vItem.raw_string,
    });
  }

  // --- Process VEND-05 (Raw Email String) ---
  for (const item of lineItems) {
    let rate: number;
    let unit: string;
    let snippet: string;

    if (item.spec_category === '5-Ply Master') {
      rate = v5Data.rules['5_ply_rate_per_kg']; // 44.00
      unit = 'per kg';
      snippet = `Email clause: "All 5-ply cartons @ Rs 44/kg base"`;
    } else if (item.spec_category === '3-Ply Universal') {
      rate = v5Data.rules['3_ply_rate_per_kg']; // 39.00
      unit = 'per kg';
      snippet = `Email clause: "All 3-ply universal cartons @ Rs 39/kg base"`;
    } else if (item.spec_category === 'Die-Cut Mailer') {
      rate = v5Data.rules['die_cut_rate_per_kg']; // 56.00
      unit = 'per kg';
      snippet = `Email clause: "Die-cut mailers @ Rs 56/kg base"`;
    } else {
      const protective = v5Data.protective_items[item.id];
      rate = protective.rate;
      unit = protective.unit;
      snippet = `Email clause: "${item.sku_name} @ Rs ${rate}/pc"`;
    }

    rawQuotesByLine.get(item.id)?.push({
      line_item_id: item.id,
      vendor_id: 'VEND-05',
      is_quoted: true,
      raw_price_string: unit === 'per kg' ? `₹${rate.toFixed(2)} / kg` : `₹${rate.toFixed(2)} / box`,
      raw_numeric_value: rate,
      raw_unit: unit,
      raw_currency: 'INR',
      modality: 'RAW_EMAIL',
      source_page_number: 1,
      source_snippet_text: `${snippet} (+4% freight extra)`,
    });
  }

  // 5. Compute Peer Median & Run Normalization Engine for all 150 Quotes
  const allNormalizedQuotes: NormalizedQuoteOutput[] = [];

  for (const item of lineItems) {
    const rawQuotes = rawQuotesByLine.get(item.id) || [];
    const specWeightKg = parseFloat(item.spec_weight_kg);

    // Compute preliminary normalized base INR for all quotes that actually quoted
    // to build clean median peer bid array
    const validPeerBids: number[] = [];

    for (const rq of rawQuotes) {
      if (rq.is_quoted && rq.raw_numeric_value !== null && rq.raw_numeric_value > 0) {
        const u = calculateUnitConversion(rq.raw_numeric_value, rq.raw_unit || 'per box', specWeightKg);
        const inrBase = convertCurrencyToInr(u.normalizedBase, rq.raw_currency, usdPegRate);
        if (inrBase > 0) {
          validPeerBids.push(inrBase);
        }
      }
    }

    // Median peer bid strictly calculated from valid bids (N=4 on lines 21-27, N=5 elsewhere)
    const medianPeerBid = calculatePeerMedian(validPeerBids);

    // Context for normalization
    for (const rq of rawQuotes) {
      let amortizedTooling = 0.0;
      let freightPct = 0.0;

      if (rq.vendor_id === 'VEND-01') {
        amortizedTooling = V1_AMORTIZED_TOOLING_PER_BOX;
      } else if (rq.vendor_id === 'VEND-05') {
        freightPct = V5_FREIGHT_SURCHARGE_PCT;
      }

      const context: LineSpecContext = {
        id: item.id,
        spec_weight_kg: specWeightKg,
        target_volume: item.target_volume,
        baseline_benchmark_price: parseFloat(item.baseline_benchmark_price),
        total_target_budget: totalBudget,
        usd_peg_rate: usdPegRate,
        amortized_tooling_inr: amortizedTooling,
        freight_surcharge_pct: freightPct,
      };

      const normalized = normalizeQuote(rq, context, medianPeerBid);
      allNormalizedQuotes.push(normalized);
    }
  }

  console.log(`⚙️  Normalized ${allNormalizedQuotes.length} quotes across 30 line items and 5 vendors.`);

  // 6. Persist to Database within Transaction
  const insertQuote = db.prepare(`
    INSERT OR REPLACE INTO vendor_line_quotes (
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

  const persistTransaction = db.transaction(() => {
    db.prepare('DELETE FROM vendor_line_quotes').run();

    for (const q of allNormalizedQuotes) {
      insertQuote.run(
        q.id,
        q.rfx_line_item_id,
        q.vendor_id,
        q.is_quoted,
        q.raw_price_string,
        q.raw_numeric_value,
        q.raw_unit,
        q.raw_currency,
        q.canonical_unit,
        q.unit_conversion_factor,
        q.normalized_base_price_inr,
        q.freight_surcharge_pct,
        q.amortized_tooling_inr,
        q.payment_term_penalty_inr,
        q.true_landed_unit_cost,
        q.signal_confidence,
        q.spec_confidence,
        q.sanity_confidence,
        q.composite_certainty,
        q.financial_exposure,
        q.review_status,
        q.source_page_number,
        q.source_bounding_box,
        q.source_snippet_text
      );
    }
  });

  persistTransaction();
  console.log('  ✅ Successfully stored 150 vendor line quotes in SQLite.');

  // 7. Breakdown of Review Statuses
  const reviewBreakdown = db
    .prepare('SELECT review_status, COUNT(*) as count FROM vendor_line_quotes GROUP BY review_status')
    .all() as { review_status: string; count: number }[];

  console.log('\n📈 Governance Review Status Distribution:');
  for (const r of reviewBreakdown) {
    console.log(`   - ${r.review_status}: ${r.count} quotes`);
  }

  // 8. Re-export CSVs to refresh data folder
  console.log('\n📄 Refreshing CSV exports...');
  exportAllTables();

  console.log('\n🎉 Step 2 Ingestion & Deterministic Normalization Pipeline Completed!');
}

if (require.main === module) {
  try {
    runIngestionPipeline();
  } catch (err) {
    console.error('❌ Ingestion pipeline failed:', err);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}
