import { getDatabase, closeDatabase } from '../../src/lib/db';

export function verifyStep2(): void {
  const db = getDatabase();
  console.log('🔍 Running Step 2 Ingestion & Deterministic Normalization Verification...\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string): void {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ [PASS] ${testName}${detail ? ` (${detail})` : ''}`);
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? ` (${detail})` : ''}`);
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  // --- TEST GROUP 1: Total Quote Population ---
  console.log('📋 Test Group 1: Total Quote Population & Relational Keys');
  const quotesCount = db.prepare('SELECT COUNT(*) as count FROM vendor_line_quotes').get() as { count: number };
  assert(quotesCount.count === 150, 'Exactly 150 quote rows populated (30 SKUs x 5 Vendors)');

  const nullFkQuotes = db
    .prepare('SELECT COUNT(*) as count FROM vendor_line_quotes WHERE rfx_line_item_id IS NULL OR vendor_id IS NULL')
    .get() as { count: number };
  assert(nullFkQuotes.count === 0, 'All quotes have valid non-null foreign keys');

  // --- TEST GROUP 2: Partial Bidders (Vendor 3) ---
  console.log('\n📋 Test Group 2: Partial Submission Handling (Vendor 3)');
  const v3Quotes = db
    .prepare('SELECT * FROM vendor_line_quotes WHERE vendor_id = ? ORDER BY rfx_line_item_id ASC')
    .all('VEND-03') as any[];
  assert(v3Quotes.length === 30, 'Vendor 3 has 30 total line item records');

  const v3Quoted = v3Quotes.filter((q) => q.is_quoted === 1);
  const v3Excluded = v3Quotes.filter((q) => q.is_quoted === 0);
  assert(v3Quoted.length === 23, 'Vendor 3 has exactly 23 quoted lines');
  assert(v3Excluded.length === 7, 'Vendor 3 has exactly 7 excluded/unquoted lines');

  const excludedSkus = v3Excluded.map((q) => q.rfx_line_item_id).sort();
  const expectedExcluded = ['PKG-021', 'PKG-022', 'PKG-023', 'PKG-024', 'PKG-025', 'PKG-026', 'PKG-027'];
  assert(
    JSON.stringify(excludedSkus) === JSON.stringify(expectedExcluded),
    'Excluded SKUs strictly match PKG-021 through PKG-027 (Die-Cut Mailers)'
  );

  const allExcludedStatus = v3Excluded.every((q) => q.review_status === 'EXCLUDED' && q.true_landed_unit_cost === null);
  assert(allExcludedStatus, 'All 7 omitted lines have review_status = EXCLUDED and null landed cost');

  // --- TEST GROUP 3: Rule A - Unit Normalization ---
  console.log('\n📋 Test Group 3: Rule A - Unit Normalization to per_box');
  // Vendor 2: /100 pcs on PKG-001
  const v2Pkg1 = db
    .prepare('SELECT * FROM vendor_line_quotes WHERE vendor_id = ? AND rfx_line_item_id = ?')
    .get('VEND-02', 'PKG-001') as any;
  assert(v2Pkg1.raw_unit === 'per 100 pcs', 'VEND-02 PKG-001 raw_unit is "per 100 pcs"');
  assert(v2Pkg1.unit_conversion_factor === '0.010000', 'VEND-02 unit_conversion_factor is 0.010000');
  assert(v2Pkg1.normalized_base_price_inr === '42.500000', 'VEND-02 PKG-001 4,250/100 scaled to ₹42.500000/box');

  // Vendor 5: /kg on PKG-001 (spec_weight: 1.15kg, rate: 44.00)
  const v5Pkg1 = db
    .prepare('SELECT * FROM vendor_line_quotes WHERE vendor_id = ? AND rfx_line_item_id = ?')
    .get('VEND-05', 'PKG-001') as any;
  assert(v5Pkg1.raw_unit === 'per kg', 'VEND-05 PKG-001 raw_unit is "per kg"');
  assert(v5Pkg1.unit_conversion_factor === '1.150000', 'VEND-05 PKG-001 unit_conversion_factor matches 1.15kg');
  assert(v5Pkg1.normalized_base_price_inr === '50.600000', 'VEND-05 PKG-001 base price is 44 * 1.15 = ₹50.600000');

  // --- TEST GROUP 4: Rule B - Currency Conversion ---
  console.log('\n📋 Test Group 4: Rule B - Currency Conversion (USD to INR @ 84.00)');
  const v4Pkg1 = db
    .prepare('SELECT * FROM vendor_line_quotes WHERE vendor_id = ? AND rfx_line_item_id = ?')
    .get('VEND-04', 'PKG-001') as any;
  assert(v4Pkg1.raw_currency === 'USD', 'VEND-04 raw_currency is USD');
  assert(v4Pkg1.raw_numeric_value === '0.5100', 'VEND-04 raw price is $0.5100');
  assert(v4Pkg1.normalized_base_price_inr === '42.840000', 'VEND-04 base price converted to ₹42.840000 ($0.51 * 84.00)');

  // --- TEST GROUP 5: Rule C - True Landed Cost ---
  console.log('\n📋 Test Group 5: Rule C - True Landed Cost Allocation');
  // Vendor 1: Base ₹45.00 + amortized tooling
  const v1Pkg1 = db
    .prepare('SELECT * FROM vendor_line_quotes WHERE vendor_id = ? AND rfx_line_item_id = ?')
    .get('VEND-01', 'PKG-001') as any;
  assert(parseFloat(v1Pkg1.amortized_tooling_inr) > 0, 'VEND-01 has non-zero amortized tooling fee');
  assert(v1Pkg1.amortized_tooling_inr === '0.017147', 'VEND-01 amortized tooling is ₹0.017147/box (₹25k / 1.458M units)');
  assert(v1Pkg1.true_landed_unit_cost === '45.017147', 'VEND-01 landed cost is ₹45.017147/box');

  // Vendor 5: Base ₹50.60 + 4% freight surcharge
  // Landed = 50.60 * 1.04 = 52.624000 (Exact match with architecture doc line 257)
  assert(v5Pkg1.freight_surcharge_pct === '0.0400', 'VEND-05 freight surcharge is 0.0400 (4%)');
  assert(v5Pkg1.true_landed_unit_cost === '52.624000', 'VEND-05 landed cost is ₹52.624000 (50.60 * 1.04)');

  // --- TEST GROUP 6: Rule D - Governance Matrix Scoring (C x E) ---
  console.log('\n📋 Test Group 6: Rule D - Governance Scoring & Review Routing');
  // PKG-001 is High Exposure (11.25% of spend)
  assert(v2Pkg1.financial_exposure === 'HIGH', 'PKG-001 exposure is HIGH');
  const v2Certainty = parseFloat(v2Pkg1.composite_certainty);
  assert(v2Certainty < 0.90, `VEND-02 Certainty C is ${v2Certainty} (< 0.90)`);
  assert(
    v2Pkg1.review_status === 'MANDATORY_BUYER_REVIEW',
    'VEND-02 on High Exposure line routes to MANDATORY_BUYER_REVIEW'
  );

  const v5Certainty = parseFloat(v5Pkg1.composite_certainty);
  assert(v5Certainty < 0.90, `VEND-05 Certainty C is ${v5Certainty} (< 0.90)`);
  assert(
    v5Pkg1.review_status === 'MANDATORY_BUYER_REVIEW',
    'VEND-05 on High Exposure line routes to MANDATORY_BUYER_REVIEW'
  );

  // Vendor 1 & 4 on PKG-001 (High certainty >= 0.90) should be AUTO_VERIFIED
  assert(v1Pkg1.review_status === 'AUTO_VERIFIED', 'VEND-01 on PKG-001 is AUTO_VERIFIED (C >= 0.90)');
  assert(v4Pkg1.review_status === 'AUTO_VERIFIED', 'VEND-04 on PKG-001 is AUTO_VERIFIED (C >= 0.90)');

  // --- TEST GROUP 7: Bounding Box Coordinate Schema ---
  console.log('\n📋 Test Group 7: Structured Bounding Box Storage');
  const v2Box = JSON.parse(v2Pkg1.source_bounding_box);
  assert(
    v2Box.page === 1 && typeof v2Box.x === 'number' && typeof v2Box.y === 'number' && typeof v2Box.w === 'number' && typeof v2Box.h === 'number',
    'VEND-02 bounding box has structured { page, x, y, w, h } coordinates'
  );

  const v4Box = JSON.parse(v4Pkg1.source_bounding_box);
  assert(
    v4Box.page === 1 && typeof v4Box.x === 'number' && typeof v4Box.y === 'number',
    'VEND-04 bounding box has structured { page, x, y, w, h } coordinates'
  );

  // --- TEST GROUP 8: Decimal Stringification (Zero floating-point approximations) ---
  console.log('\n📋 Test Group 8: Clean Decimal Stringification');
  const nonCleanRate = db
    .prepare(`
      SELECT COUNT(*) as count FROM vendor_line_quotes 
      WHERE normalized_base_price_inr LIKE '%.%0000000%' 
         OR true_landed_unit_cost LIKE '%.%0000000%'
    `)
    .get() as { count: number };
  assert(nonCleanRate.count === 0, 'Zero raw JS floating-point string drift in database');

  console.log(`\n========================================`);
  console.log(`🎉 ALL ${passedTests}/${totalTests} STEP 2 TESTS PASSED SUCCESSFULLY!`);
  console.log(`========================================\n`);
}

if (require.main === module) {
  try {
    verifyStep2();
  } catch (err) {
    console.error('❌ Step 2 verification failed:', err);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}
