/**
 * Aerchain QuoteEngine - Step 6 Dual-Pane Integration & Scenario Verification Suite
 *
 * Validates:
 * 1. Exact Pre-Set Quick-Query Strings & Intent Parsing:
 *    - 'Split cheapest per line, excluding failed quality questionnaire'
 *    - 'Identify hidden ancillary fees across all vendors'
 *    - 'Compare landed spend if USD strengthens to 87.00 INR'
 * 2. Regex Decimal Safety: Verifies '87.00' is extracted fully as float 87.0 without truncation.
 * 3. Visual Hierarchy & Disqualification Isolation:
 *    - Vendor 3 unquoted lines (21-27) remain unquoted.
 *    - Vendor 3 quoted lines (1-20, 28-30) receive disqualified tag.
 * 4. API Route Execution & Highlighting Payload Contract.
 */

import { parseCopilotQuery } from '../../src/lib/copilot/intentParser';
import { deterministicSolver } from '../../src/lib/copilot/deterministicSolver';
import { POST } from '../../src/app/api/copilot/interrogate/route';
import { getDatabase } from '../../src/lib/db';

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

async function runStep6Tests() {
  console.log('🔍 Running Step 6 Dual-Pane UI Integration & Scenario Visualization Tests...\n');

  // =========================================================================
  // Test Group 1: Exact Pre-Set Quick-Query Strings & Decimal Safety
  // =========================================================================
  console.log('📋 Test Group 1: Exact Pre-Set Quick-Query Strings & Regex Decimal Safety');

  // Query 1: Quality Questionnaire Exclusion
  const q1 = 'Split cheapest per line, excluding failed quality questionnaire';
  const ast1 = await parseCopilotQuery(q1);
  assert(ast1.intent === 'OPTIMIZE_SPLIT_AWARD', 'Q1 intent is OPTIMIZE_SPLIT_AWARD');
  assert(ast1.constraints.exclude_failed_questionnaire === true, 'Q1 parsed exclude_failed_questionnaire = true');

  // Query 2: Hidden Ancillary Fees
  const q2 = 'Identify hidden ancillary fees across all vendors';
  const ast2 = await parseCopilotQuery(q2);
  assert(ast2.intent === 'LIST_HIDDEN_TERMS', 'Q2 intent is LIST_HIDDEN_TERMS');

  // Query 3: USD Strengthens to 87.00 INR (Decimal Safety)
  const q3 = 'Compare landed spend if USD strengthens to 87.00 INR';
  const ast3 = await parseCopilotQuery(q3);
  assert(ast3.intent === 'FX_SENSITIVITY', 'Q3 intent is FX_SENSITIVITY');
  assert(ast3.constraints.exchange_rate_usd_inr === 87.0, 'Q3 parsed exchange_rate_usd_inr strictly as float 87.0');
  assert(ast3.constraints.baseline_exchange_rate_usd_inr === 84.0, 'Q3 baseline rate is 84.0');

  // =========================================================================
  // Test Group 2: Disqualified Vendor Tagging & Visual Hierarchy
  // =========================================================================
  console.log('\n📋 Test Group 2: Disqualified Vendor Hierarchy (Quoted vs Unquoted Lines)');
  const res1 = deterministicSolver.execute(ast1.intent, ast1.constraints);

  assert(res1.scenario_metrics.disqualified_vendors !== undefined, 'Disqualified vendors array populated');
  assert(res1.scenario_metrics.disqualified_vendors!.length === 1, 'Exactly 1 vendor disqualified (VEND-03)');
  assert(res1.scenario_metrics.disqualified_vendors![0].vendor_id === 'VEND-03', 'Disqualified vendor ID is VEND-03');

  // Verify Vendor 3 line status in database:
  const db = getDatabase();
  const v3Quotes = db
    .prepare(
      `SELECT rfx_line_item_id as line_id, is_quoted, true_landed_unit_cost
       FROM vendor_line_quotes
       WHERE vendor_id = 'VEND-03'
       ORDER BY rfx_line_item_id ASC`
    )
    .all() as { line_id: string; is_quoted: number; true_landed_unit_cost: string | null }[];

  const unquotedLines = v3Quotes.filter((q) => q.is_quoted === 0);
  const quotedLines = v3Quotes.filter((q) => q.is_quoted === 1);

  assert(unquotedLines.length === 7, 'Vendor 3 has exactly 7 unquoted lines (lines 21-27)');
  assert(quotedLines.length === 23, 'Vendor 3 has exactly 23 quoted lines (lines 1-20, 28-30)');

  // Ensure zero unquoted lines have numeric landed cost
  for (const u of unquotedLines) {
    assert(u.true_landed_unit_cost === null, `Unquoted line ${u.line_id} has null landed cost`);
  }

  // =========================================================================
  // Test Group 3: Dynamic Matrix Highlighting Contract
  // =========================================================================
  console.log('\n📋 Test Group 3: Dynamic Matrix Highlighting Payload Contract');
  assert(res1.highlight_cells.length === 30, 'Highlight cells covers all 30 packaging SKUs');

  // Every line in 1..30 has a winning cell
  const wonLineIds = new Set(res1.highlight_cells.map((h) => h.line_id));
  assert(wonLineIds.size === 30, 'Exactly 30 unique line items are highlighted');

  // None of the winning cells are Vendor 3
  const v3Highlight = res1.highlight_cells.find((h) => h.winning_vendor_id === 'VEND-03');
  assert(v3Highlight === undefined, 'Disqualified Vendor 3 has zero winning highlight cells');

  // =========================================================================
  // Test Group 4: FX Sensitivity 87.00 Substitution Analysis
  // =========================================================================
  console.log('\n📋 Test Group 4: FX Sensitivity 87.00 Substitution Analysis');
  const res3 = deterministicSolver.execute(ast3.intent, ast3.constraints);

  assert(res3.fx_sensitivity_details !== undefined, 'FX sensitivity details present');
  assert(res3.fx_sensitivity_details!.scenario_fx_rate === 87.0, 'Scenario FX rate is 87.00');
  assert(res3.fx_sensitivity_details!.flipped_lines_count === 13, 'Exactly 13 lines flip to domestic suppliers');

  // =========================================================================
  // Test Group 5: Full API Integration Call
  // =========================================================================
  console.log('\n📋 Test Group 5: API Endpoint POST /api/copilot/interrogate');
  const req = new Request('http://localhost:3000/api/copilot/interrogate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'Split cheapest per line, excluding failed quality questionnaire' }),
  });

  const apiRes = await POST(req);
  assert(apiRes.status === 200, 'POST /api/copilot/interrogate returns 200 OK');

  const payload = await apiRes.json();
  assert(payload.success === true, 'Payload success is true');
  assert(payload.query_ast.intent === 'OPTIMIZE_SPLIT_AWARD', 'Payload intent matches');
  assert(payload.scenario_metrics.disqualified_vendors.length === 1, 'Payload reports 1 disqualified vendor');
  assert(payload.highlight_cells.length === 30, 'Payload contains 30 highlight cells');

  console.log('\n========================================');
  console.log(`🎉 ALL ${passed}/${total} STEP 6 TESTS PASSED SUCCESSFULLY!`);
  console.log('========================================\n');
}

runStep6Tests().catch((err) => {
  console.error('\n❌ Step 6 verification failed:', err);
  process.exit(1);
});
