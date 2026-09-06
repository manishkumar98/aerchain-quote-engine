import { GET as getMatrix } from '../../src/app/api/matrix/route';
import { GET as getProvenance } from '../../src/app/api/quotes/[id]/provenance/route';
import { POST as confirmQuote } from '../../src/app/api/quotes/[id]/confirm/route';
import { getDatabase, closeDatabase } from '../../src/lib/db';

export async function runIntegrationTests(): Promise<void> {
  console.log('🧪 Starting Step 3 Backend API Integration Tests...\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string): void {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ [PASS] ${testName}${detail ? ` (${detail})` : ''}`);
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? ` (${detail})` : ''}`);
      throw new Error(`Integration assertion failed: ${testName}`);
    }
  }

  // --- TEST GROUP 1: GET /api/matrix ---
  console.log('📋 Test Group 1: GET /api/matrix');
  const matrixReq = new Request('http://localhost:3000/api/matrix');
  const matrixRes = await getMatrix();
  assert(matrixRes.status === 200, 'GET /api/matrix returns HTTP 200 OK');

  const matrixData = await matrixRes.json();
  assert(matrixData.rfx_id === 'RFX-2026-CORR', 'Matrix RFx ID is RFX-2026-CORR');
  assert(matrixData.total_budget_inr === 40000000.0, 'Total budget is ₹40,000,000.00');
  assert(matrixData.lines.length === 30, 'Matrix contains exactly 30 line items');
  assert(matrixData.vendors.length === 5, 'Matrix contains exactly 5 vendor definitions');

  // Validate all 30 rows have quotes for all 5 vendors
  let validQuoteCount = 0;
  let excludedQuoteCount = 0;

  for (const line of matrixData.lines) {
    const vendorsInLine = Object.keys(line.quotes);
    assert(vendorsInLine.length === 5, `Line ${line.line_id} has quotes for all 5 vendors`);

    for (const vId of ['VEND-01', 'VEND-02', 'VEND-03', 'VEND-04', 'VEND-05']) {
      const q = line.quotes[vId];
      assert(!!q, `Quote object exists for ${vId} in ${line.line_id}`);
      assert(typeof q.review_status === 'string', `${vId} in ${line.line_id} has review_status`);

      if (q.is_quoted) {
        validQuoteCount++;
        assert(typeof q.landed_cost_inr === 'number' && q.landed_cost_inr > 0, `${vId} ${line.line_id} has numeric landed cost`);
      } else {
        excludedQuoteCount++;
        assert(q.landed_cost_inr === null, `Unquoted item ${vId} ${line.line_id} has null landed cost`);
        assert(q.review_status === 'EXCLUDED', `Unquoted item ${vId} ${line.line_id} has EXCLUDED status`);
      }
    }
  }

  assert(validQuoteCount === 143, 'Exactly 143 quoted lines across grid (150 total - 7 excluded)');
  assert(excludedQuoteCount === 7, 'Exactly 7 excluded lines across grid (Vendor 3 lines 21-27)');

  // Check surcharge chips on PKG-001
  const pkg1 = matrixData.lines.find((l: any) => l.line_id === 'PKG-001');
  const v1Pkg1 = pkg1.quotes['VEND-01'];
  const v4Pkg1 = pkg1.quotes['VEND-04'];
  const v5Pkg1 = pkg1.quotes['VEND-05'];

  assert(v1Pkg1.surcharge_chips.some((c: any) => c.type === 'TOOLING'), 'VEND-01 PKG-001 has TOOLING chip');
  assert(v4Pkg1.surcharge_chips.some((c: any) => c.type === 'FX_PEG'), 'VEND-04 PKG-001 has FX_PEG chip');
  assert(v5Pkg1.surcharge_chips.some((c: any) => c.type === 'FREIGHT'), 'VEND-05 PKG-001 has FREIGHT chip');

  // --- TEST GROUP 2: GET /api/quotes/:id/provenance ---
  console.log('\n📋 Test Group 2: GET /api/quotes/:id/provenance');
  const provReq = new Request('http://localhost:3000/api/quotes/QUOTE-VEND-02-PKG-001/provenance');
  const provRes = await getProvenance(provReq, { params: Promise.resolve({ id: 'QUOTE-VEND-02-PKG-001' }) });
  assert(provRes.status === 200, 'GET provenance returns HTTP 200 OK');

  const provData = await provRes.json();
  assert(provData.quote_id === 'QUOTE-VEND-02-PKG-001', 'Provenance quote_id matches');
  assert(provData.vendor_name === 'Apex Cartons & Containers', 'Vendor name is Apex Cartons & Containers');
  assert(provData.document_name === 'vend02_apex_cartons_scan.jpg', 'Document name matches');
  assert(provData.document_sha256 && provData.document_sha256.length === 64, 'Document SHA256 is present and valid 64-char hash');

  // Check structured bounding box
  assert(
    provData.bounding_box &&
      provData.bounding_box.page === 1 &&
      provData.bounding_box.x === 142 &&
      provData.bounding_box.y === 380 &&
      provData.bounding_box.w === 280 &&
      provData.bounding_box.h === 50,
    'Structured bounding box coordinates { page: 1, x: 142, y: 380, w: 280, h: 50 } match specification'
  );

  // Check strict rule-based audit trail
  assert(Array.isArray(provData.conversion_audit_trail), 'conversion_audit_trail is an array');
  assert(provData.conversion_audit_trail.length >= 5, 'conversion_audit_trail has >= 5 deterministic steps');
  assert(
    provData.conversion_audit_trail.some((s: string) => s.includes('UNIT_SCALE')),
    'Audit trail explicitly cites UNIT_SCALE rule'
  );
  assert(
    provData.conversion_audit_trail.some((s: string) => s.includes('42.500000')),
    'Audit trail shows exact 42.500000 normalized rate'
  );

  // Test 404 for invalid quote ID
  const notFoundRes = await getProvenance(provReq, { params: Promise.resolve({ id: 'NON_EXISTENT_QUOTE_ID' }) });
  assert(notFoundRes.status === 404, 'Non-existent quote ID returns HTTP 404');

  // --- TEST GROUP 3: POST /api/quotes/:id/confirm ---
  console.log('\n📋 Test Group 3: POST /api/quotes/:id/confirm (Sign-off & Override)');
  const confirmReq = new Request('http://localhost:3000/api/quotes/QUOTE-VEND-02-PKG-001/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      confirmed_rate_inr: 42.25,
      override_reason: 'Buyer cross-verified physical rate card and negotiated ₹42.25/box.',
    }),
  });

  const confirmRes = await confirmQuote(confirmReq, { params: Promise.resolve({ id: 'QUOTE-VEND-02-PKG-001' }) });
  assert(confirmRes.status === 200, 'POST confirm returns HTTP 200 OK');

  const confirmData = await confirmRes.json();
  assert(confirmData.success === true, 'Confirm response success is true');
  assert(confirmData.new_status === 'BUYER_CONFIRMED', 'Quote status updated to BUYER_CONFIRMED');
  assert(confirmData.normalized_base_price_inr === 42.25, 'Normalized base price recalculated to ₹42.25');
  assert(confirmData.true_landed_unit_cost === 42.25, 'True landed unit cost atomically recalculated to ₹42.25');

  // Verify that Provenance now reflects the buyer confirmation
  const provAfterRes = await getProvenance(provReq, { params: Promise.resolve({ id: 'QUOTE-VEND-02-PKG-001' }) });
  const provAfterData = await provAfterRes.json();
  assert(provAfterData.is_confirmed_by_buyer === true, 'Provenance confirms is_confirmed_by_buyer is now true');
  assert(provAfterData.review_status === 'BUYER_CONFIRMED', 'Provenance review_status is BUYER_CONFIRMED');
  assert(
    provAfterData.human_override_reason === 'Buyer cross-verified physical rate card and negotiated ₹42.25/box.',
    'Human override reason recorded in audit log'
  );
  assert(!!provAfterData.reviewed_at, 'reviewed_at timestamp is populated');

  // Verify that Matrix now shows BUYER_CONFIRMED for this cell
  const matrixAfterRes = await getMatrix();
  const matrixAfterData = await matrixAfterRes.json();
  const pkg1After = matrixAfterData.lines.find((l: any) => l.line_id === 'PKG-001');
  assert(
    pkg1After.quotes['VEND-02'].review_status === 'BUYER_CONFIRMED',
    'Matrix grid reflects BUYER_CONFIRMED for VEND-02 PKG-001'
  );
  assert(
    pkg1After.quotes['VEND-02'].landed_cost_inr === 42.25,
    'Matrix grid displays updated landed cost of ₹42.25'
  );
  assert(
    matrixAfterData.review_summary.buyer_confirmed >= 1,
    'Matrix review_summary reflects at least 1 buyer confirmed quote'
  );

  // Restore the baseline quote state so tests remain idempotent
  const db = getDatabase();
  db.prepare(`
    UPDATE vendor_line_quotes 
    SET 
      normalized_base_price_inr = '42.500000',
      true_landed_unit_cost = '42.500000',
      review_status = 'MANDATORY_BUYER_REVIEW',
      human_override_reason = NULL,
      reviewed_at = NULL
    WHERE id = 'QUOTE-VEND-02-PKG-001'
  `).run();

  console.log(`\n========================================`);
  console.log(`🎉 ALL ${passedTests}/${totalTests} STEP 3 INTEGRATION TESTS PASSED!`);
  console.log(`========================================\n`);
}

if (require.main === module) {
  runIntegrationTests()
    .then(() => closeDatabase())
    .catch((err) => {
      console.error('❌ Step 3 integration test run failed:', err);
      closeDatabase();
      process.exit(1);
    });
}
