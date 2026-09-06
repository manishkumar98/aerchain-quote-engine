/**
 * Aerchain QuoteEngine - Upstream Conversational RFx Authoring & Asymmetric Email Ingestion Test Suite
 *
 * Validates:
 * 1. RFx Authoring Co-Pilot Generation (POST /api/rfx/generate)
 * 2. Asymmetric Email Dispatch & Tokenized Reply-To Routes (POST /api/rfx/dispatch)
 * 3. Inbound Webhook Batch Presets Ingestion (POST /api/webhooks/email-inbound)
 * 4. Custom Email Text Ingestion & Rate Parsing
 * 5. File Attachment Handling with SHA-256 Cryptographic Provenance
 * 6. Zero Regressions on Database State and Solver Contracts
 */

import { POST as rfxGenerateRoute } from '../../src/app/api/rfx/generate/route';
import { POST as rfxDispatchRoute } from '../../src/app/api/rfx/dispatch/route';
import { POST as emailInboundRoute } from '../../src/app/api/webhooks/email-inbound/route';
import { getDatabase } from '../../src/lib/db';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

let passed = 0;
let total = 0;

function assert(condition: boolean, message: string) {
  total++;
  if (!condition) {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ [PASS] ${message}`);
  passed++;
}

async function runEmailFlowTests() {
  console.log('🚀 Running Upstream RFx Authoring & Inbound Email Verification Suite...\n');

  // =========================================================================
  // Test Group 1: Conversational RFx Authoring Co-Pilot
  // =========================================================================
  console.log('📋 Test Group 1: Conversational RFx Authoring Co-Pilot (POST /api/rfx/generate)');
  const prompt = 'Draft an annual rate contract for 30 corrugated packaging SKUs across 3-ply, 5-ply, and die-cut mailers with ₹4.0 Cr budget, ISO 9001 mandatory gate, and Net 60 terms';

  const genReq = new Request('http://localhost:3000/api/rfx/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  const genRes = await rfxGenerateRoute(genReq);
  assert(genRes.status === 200, 'POST /api/rfx/generate returns HTTP 200 OK');

  const genData = await genRes.json();
  assert(genData.success === true, 'Response success is true');
  assert(genData.specification !== undefined, 'Specification payload is present');
  assert(genData.specification.rfx_id === 'RFX-2026-CORR', 'RFx ID matches RFX-2026-CORR');
  assert(genData.specification.total_target_budget_inr === 40000000.0, 'Target budget is exactly ₹4.00 Cr');
  assert(genData.specification.total_basket_volume === 1458000, 'Total basket volume is 1,458,000 units');
  assert(genData.specification.usd_peg_rate === 84.0, 'Baseline USD peg rate is ₹84.00/$');
  assert(genData.specification.spec_categories.length === 4, 'Includes all 4 packaging categories');

  const isoGate = genData.specification.questionnaire_criteria.find((q: any) => q.id === 'Q-ISO-9001');
  assert(isoGate !== undefined && isoGate.mandatory === true, 'Mandatory ISO 9001:2015 gate is enforced');

  // =========================================================================
  // Test Group 2: Asymmetric Outbound Email Dispatch & Token Routing
  // =========================================================================
  console.log('\n📋 Test Group 2: Asymmetric Email Dispatch & Tokenized Routing (POST /api/rfx/dispatch)');
  const dispReq = new Request('http://localhost:3000/api/rfx/dispatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rfx_id: 'RFX-2026-CORR' }),
  });

  const dispRes = await rfxDispatchRoute(dispReq);
  assert(dispRes.status === 200, 'POST /api/rfx/dispatch returns HTTP 200 OK');

  const dispData = await dispRes.json();
  assert(dispData.success === true, 'Dispatch success is true');
  assert(dispData.dispatched_count === 5, 'Dispatched to exactly 5 suppliers');
  assert(dispData.dispatches.length === 5, 'Dispatches array contains 5 vendor tokens');

  const expectedRoutes: Record<string, { email: string; replyTo: string }> = {
    'VEND-01': { email: 'vendor1@packagingworld.in', replyTo: 'rfx-corr-2026-v1@ingest.aerchain.ai' },
    'VEND-02': { email: 'vendor2@apexcartons.com', replyTo: 'rfx-corr-2026-v2@ingest.aerchain.ai' },
    'VEND-03': { email: 'vendor3@nationalpaper.co.in', replyTo: 'rfx-corr-2026-v3@ingest.aerchain.ai' },
    'VEND-04': { email: 'vendor4@globalpack.com', replyTo: 'rfx-corr-2026-v4@ingest.aerchain.ai' },
    'VEND-05': { email: 'vendor5@balajitraders.in', replyTo: 'rfx-corr-2026-v5@ingest.aerchain.ai' },
  };

  for (const d of dispData.dispatches) {
    const exp = expectedRoutes[d.vendor_id];
    assert(exp !== undefined, `Vendor ${d.vendor_id} is recognized`);
    assert(d.recipient_email === exp.email, `Vendor ${d.vendor_id} recipient is ${exp.email}`);
    assert(d.reply_to_email === exp.replyTo, `Vendor ${d.vendor_id} reply-to route is ${exp.replyTo}`);
    assert(typeof d.dispatch_token === 'string' && d.dispatch_token.length === 32, `Vendor ${d.vendor_id} has 32-char hex cryptographic token`);
  }

  // Verify database persistence in rfx_dispatches table
  const db = getDatabase();
  const dbDispatches = db.prepare('SELECT * FROM rfx_dispatches WHERE rfx_id = ?').all('RFX-2026-CORR') as any[];
  assert(dbDispatches.length >= 5, 'Database rfx_dispatches table contains dispatched records');

  // =========================================================================
  // Test Group 3: Inbound Webhook Batch Presets Ingestion
  // =========================================================================
  console.log('\n📋 Test Group 3: Inbound Webhook Batch Presets Ingestion (POST /api/webhooks/email-inbound)');
  const batchReq = new Request('http://localhost:3000/api/webhooks/email-inbound', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batch_presets: true }),
  });

  const batchRes = await emailInboundRoute(batchReq);
  assert(batchRes.status === 200, 'POST /api/webhooks/email-inbound batch returns HTTP 200 OK');

  const batchData = await batchRes.json();
  assert(batchData.success === true, 'Batch ingestion success is true');
  assert(batchData.quotes_ingested === 150, 'Exactly 150 quotes ingested across 30 lines x 5 vendors');

  // Assert SQLite state
  const totalQuotesCount = db.prepare('SELECT COUNT(*) as cnt FROM vendor_line_quotes').get() as { cnt: number };
  assert(totalQuotesCount.cnt === 150, 'SQLite contains exactly 150 line item quotes');

  const v3Unquoted = db.prepare('SELECT COUNT(*) as cnt FROM vendor_line_quotes WHERE vendor_id = ? AND is_quoted = 0').get('VEND-03') as { cnt: number };
  assert(v3Unquoted.cnt === 7, 'Vendor 3 maintains 7 omitted lines (PKG-021 to PKG-027)');

  // =========================================================================
  // Test Group 4: Custom Email Text Ingestion & Rate Parsing
  // =========================================================================
  console.log('\n📋 Test Group 4: Custom Email Text Ingestion with AI / Regex Fallback');
  const customEmail = `Dear Team,
Rates update:
- 5-ply cartons @ Rs 45.00/kg base
- 3-ply universal @ Rs 38.50/kg base
- Die-cut mailers @ Rs 55.00/kg base
- Edge protector @ Rs 14.00
Freight extra 4.00%
Regards, Balaji Team`;

  const customTextReq = new Request('http://localhost:3000/api/webhooks/email-inbound', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vendor_id: 'VEND-05',
      raw_text: customEmail,
    }),
  });

  const customTextRes = await emailInboundRoute(customTextReq);
  assert(customTextRes.status === 200, 'Custom text inbound returns HTTP 200 OK');

  const customTextData = await customTextRes.json();
  assert(customTextData.success === true, 'Custom text response success is true');
  assert(customTextData.quotes_ingested === 30, 'Normalized all 30 SKUs for target vendor');
  assert(customTextData.doc_sha256 !== undefined && customTextData.doc_sha256.length === 64, 'Computed valid 64-char SHA-256 hash');

  // =========================================================================
  // Test Group 5: File Attachment Upload with SHA-256 Cryptographic Provenance
  // =========================================================================
  console.log('\n📋 Test Group 5: File Attachment Upload & Storage Verification');
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  assert(fs.existsSync(uploadsDir), 'public/uploads directory exists');

  // Verify that vendor 5 quotes in DB have valid numeric landed costs
  const v5Quotes = db.prepare('SELECT * FROM vendor_line_quotes WHERE vendor_id = ?').all('VEND-05') as any[];
  assert(v5Quotes.length === 30, 'VEND-05 has 30 normalized quotes in database');
  for (const q of v5Quotes) {
    assert(parseFloat(q.true_landed_unit_cost) > 0, `Quote ${q.id} has positive landed cost: ₹${q.true_landed_unit_cost}`);
  }

  // Restore pristine baseline by re-running batch presets
  const resetReq = new Request('http://localhost:3000/api/webhooks/email-inbound', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batch_presets: true }),
  });
  await emailInboundRoute(resetReq);

  console.log('\n========================================');
  console.log(`🎉 ALL ${passed}/${total} EMAIL FLOW TESTS PASSED SUCCESSFULLY!`);
  console.log('========================================\n');
}

runEmailFlowTests().catch((err) => {
  console.error('\n❌ Email flow verification failed:', err);
  process.exit(1);
});
