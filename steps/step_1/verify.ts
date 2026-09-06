import { getDatabase, closeDatabase } from '../../src/lib/db';

export function verifyDatabase(): void {
  const db = getDatabase();
  console.log('🔍 Running Database & Data Integrity Verification...\n');

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

  // --- TEST 1: Foreign Key Enforcement ---
  console.log('📋 Test Group 1: SQLite Connection & Pragma Enforcement');
  const fkPragma = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number };
  assert(fkPragma.foreign_keys === 1, 'PRAGMA foreign_keys is enabled (1)');

  const journalPragma = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
  assert(journalPragma.journal_mode.toLowerCase() === 'wal', 'Journal mode is WAL');

  // Test FK Constraint Rejection
  let fkRejected = false;
  try {
    db.prepare(`
      INSERT INTO rfx_line_items (
        id, rfx_id, line_number, sku_name, spec_category, dimensions, spec_weight_kg, target_volume, baseline_benchmark_price
      ) VALUES ('PKG-INVALID', 'NON_EXISTENT_RFX', 99, 'Fake Item', '5-Ply Master', '100x100x100', '1.0', 1000, '10.0')
    `).run();
  } catch (err: any) {
    if (err.message.includes('FOREIGN KEY constraint failed')) {
      fkRejected = true;
    }
  }
  assert(fkRejected, 'FK violation correctly rejected when inserting invalid rfx_id');

  // --- TEST 2: Master RFx Table ---
  console.log('\n📋 Test Group 2: Master RFx Verification');
  const master = db.prepare('SELECT * FROM rfx_master WHERE id = ?').get('RFX-2026-CORR') as any;
  assert(!!master, 'Master RFX-2026-CORR exists');
  assert(master.category === 'Corrugated Packaging', 'Category is Corrugated Packaging');
  assert(master.baseline_currency === 'INR', 'Baseline currency is INR');
  assert(master.usd_peg_rate === '84.0000', 'USD Peg Rate is 84.0000');
  assert(master.total_target_budget === '40000000.00', 'Total target budget is ₹4.0 Cr (40000000.00)');

  // --- TEST 3: Canonical Packaging Line Items ---
  console.log('\n📋 Test Group 3: Canonical Packaging Line Items (30 SKUs)');
  const lineItems = db.prepare('SELECT * FROM rfx_line_items ORDER BY line_number ASC').all() as any[];
  assert(lineItems.length === 30, 'Exactly 30 line items present');

  const fivePly = lineItems.filter((i) => i.spec_category === '5-Ply Master');
  const threePly = lineItems.filter((i) => i.spec_category === '3-Ply Universal');
  const dieCut = lineItems.filter((i) => i.spec_category === 'Die-Cut Mailer');
  const protective = lineItems.filter((i) => i.spec_category === 'Protective');

  assert(fivePly.length === 10, 'Lines 01–10: Exactly 10 5-Ply Master Shippers');
  assert(threePly.length === 10, 'Lines 11–20: Exactly 10 3-Ply Universal Cartons');
  assert(dieCut.length === 7, 'Lines 21–27: Exactly 7 Die-Cut Self-Locking Mailers');
  assert(protective.length === 3, 'Lines 28–30: Exactly 3 Ancillary Protective Packaging Items');

  // Verify weight ranges per category
  const fivePlyWeightsValid = fivePly.every((i) => {
    const w = parseFloat(i.spec_weight_kg);
    return w >= 0.75 && w <= 1.20;
  });
  assert(fivePlyWeightsValid, '5-Ply weights all within 0.75kg – 1.20kg');

  const threePlyWeightsValid = threePly.every((i) => {
    const w = parseFloat(i.spec_weight_kg);
    return w >= 0.35 && w <= 0.55;
  });
  assert(threePlyWeightsValid, '3-Ply weights all within 0.35kg – 0.55kg');

  const dieCutWeightsValid = dieCut.every((i) => {
    const w = parseFloat(i.spec_weight_kg);
    return w >= 0.15 && w <= 0.25;
  });
  assert(dieCutWeightsValid, 'Die-Cut weights all within 0.15kg – 0.25kg');

  // Verify Spend Exposure Math: sum(target_volume * baseline_benchmark_price)
  let totalSpend = 0;
  let highExposureCount = 0;
  let mediumExposureCount = 0;
  let lowExposureCount = 0;
  const totalBudget = parseFloat(master.total_target_budget);

  for (const item of lineItems) {
    const spend = item.target_volume * parseFloat(item.baseline_benchmark_price);
    totalSpend += spend;
    const weightFraction = spend / totalBudget;
    if (weightFraction >= 0.05) {
      highExposureCount++;
    } else if (weightFraction >= 0.02) {
      mediumExposureCount++;
    } else {
      lowExposureCount++;
    }
  }

  assert(
    Math.abs(totalSpend - 40000000.0) < 0.01,
    'Total spend aligns with ₹4.0 Cr budget target',
    `Calculated: ₹${totalSpend.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  );
  assert(highExposureCount > 0, `High Exposure items present (Count: ${highExposureCount})`);
  assert(lowExposureCount > 0, `Low Exposure items present (Count: ${lowExposureCount})`);
  console.log(`     Exposure Breakdown: ${highExposureCount} HIGH, ${mediumExposureCount} MEDIUM, ${lowExposureCount} LOW`);

  // --- TEST 4: Vendor Profiles & Compliance ---
  console.log('\n📋 Test Group 4: Vendor Profiles & Compliance Data');
  const vendors = db.prepare('SELECT * FROM vendors ORDER BY id ASC').all() as any[];
  assert(vendors.length === 5, 'Exactly 5 vendor profiles present');

  const v1 = vendors.find((v) => v.id === 'VEND-01');
  assert(v1.iso_9001_certified === 1 && v1.fsc_certified === 1 && v1.credit_terms === 'Net 60', 'Vendor 1: ISO=True, FSC=True, Net 60');

  const v2 = vendors.find((v) => v.id === 'VEND-02');
  assert(v2.iso_9001_certified === 1 && v2.fsc_certified === 0 && v2.credit_terms === 'Net 30', 'Vendor 2: ISO=True, FSC=False, Net 30');

  const v3 = vendors.find((v) => v.id === 'VEND-03');
  assert(v3.iso_9001_certified === 0 && v3.quality_audit_score === '52.00', 'Vendor 3: ISO=False with 52% Audit Score');

  const v4 = vendors.find((v) => v.id === 'VEND-04');
  assert(v4.inbound_modality === 'FOREIGN_USD_PDF' && v4.iso_9001_certified === 1 && v4.fsc_certified === 1, 'Vendor 4: USD Foreign Bidder, ISO/FSC=True');

  const v5 = vendors.find((v) => v.id === 'VEND-05');
  assert(v5.inbound_modality === 'RAW_EMAIL' && v5.iso_9001_certified === 1 && v5.credit_terms === 'Net 15', 'Vendor 5: RAW_EMAIL, ISO=True, Net 15');

  // --- TEST 5: Off-Sheet Ancillary Charges ---
  console.log('\n📋 Test Group 5: Ancillary Charges');
  const charges = db.prepare('SELECT * FROM vendor_ancillary_charges ORDER BY id ASC').all() as any[];
  assert(charges.length === 2, 'Exactly 2 initial ancillary charges seeded');

  const v1PlateFee = charges.find((c) => c.vendor_id === 'VEND-01' && c.fee_type === 'TOOLING_PLATE_FEE');
  assert(v1PlateFee && v1PlateFee.amount_inr === '25000.00', 'VEND-01 Tooling Plate Fee of ₹25,000 present');

  const v5Freight = charges.find((c) => c.vendor_id === 'VEND-05' && c.fee_type === 'FREIGHT_SURCHARGE');
  assert(v5Freight && v5Freight.percentage_value === '0.0400', 'VEND-05 Freight Surcharge of 4.0% present');

  console.log(`\n========================================`);
  console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log(`========================================\n`);
}

if (require.main === module) {
  try {
    verifyDatabase();
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}
