/**
 * Aerchain QuoteEngine - Step 5 Verification Test Suite
 *
 * Validates:
 * 1. Zero LLM Arithmetic Enforcement (Intent Parser outputs pure AST schema; zero math in tokens).
 * 2. Benchmark Query 1: Cheapest split-award excluding ISO failed vendors (Disqualifies VEND-03, audits math).
 * 3. Benchmark Query 2: Buried footnote fees & unquoted ancillary surcharges across all 5 suppliers.
 * 4. Benchmark Query 3: FX Sensitivity (Quantifying flipped lines and substitution effect when USD moves 84 -> 87).
 * 5. Mathematical Invariant Check: Sum of vendor allocations strictly matches total spend.
 * 6. API Route Integration: POST /api/copilot/interrogate contract verification.
 */

import { parseCopilotQuery, parseIntentDeterministic } from '../../src/lib/copilot/intentParser';
import { deterministicSolver, formatINR, formatINRExecutive } from '../../src/lib/copilot/deterministicSolver';
import { POST } from '../../src/app/api/copilot/interrogate/route';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (!condition) {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ [PASS] ${message}`);
  passedTests++;
}

async function runStep5Tests() {
  console.log('🔍 Running Step 5 Deterministic NL Interrogation Engine Verification...\n');

  // =========================================================================
  // Test Group 1: Zero LLM Arithmetic Enforcement (Layer 1 Intent Parser)
  // =========================================================================
  console.log('📋 Test Group 1: Zero LLM Arithmetic Enforcement (Layer 1 AST Generation)');
  const q1 = 'What is the cheapest split-award per line excluding vendors failing ISO quality?';
  const ast1 = await parseCopilotQuery(q1);

  assert(ast1.intent === 'OPTIMIZE_SPLIT_AWARD', 'Q1 intent classified as OPTIMIZE_SPLIT_AWARD');
  assert(ast1.constraints.exclude_failed_questionnaire === true, 'Q1 parsed exclude_failed_questionnaire = true');
  assert(ast1.zero_arithmetic_verified === true, 'Q1 AST verifies zero arithmetic in token generation');
  assert((ast1 as any).total_spend === undefined, 'Layer 1 AST contains NO calculated total_spend token');
  assert((ast1 as any).savings === undefined, 'Layer 1 AST contains NO calculated savings token');
  assert((ast1 as any).allocated_spend === undefined, 'Layer 1 AST contains NO calculated allocated_spend token');

  // =========================================================================
  // Test Group 2: Benchmark Query 1 - Cheapest Split Award & Disqualification
  // =========================================================================
  console.log('\n📋 Test Group 2: Benchmark Query 1 - Split-Award Optimization & Compliance Transparency');
  const res1 = deterministicSolver.execute(ast1.intent, ast1.constraints);

  assert(res1.scenario_metrics.total_spend_inr > 0, 'Total spend is non-zero and positive');
  assert(res1.scenario_metrics.baseline_spend_inr === 40000000.0, 'Baseline spend is exactly ₹4.00 Cr (40,000,000.00)');
  assert(res1.scenario_metrics.savings_vs_baseline_inr > 0, 'Split award generates positive savings vs ₹4.00 Cr budget');

  // Assert Vendor 3 Disqualification Transparency
  assert(res1.scenario_metrics.disqualified_vendors !== undefined, 'Disqualified vendors array is present');
  assert(res1.scenario_metrics.disqualified_vendors!.length === 1, 'Exactly 1 vendor disqualified (VEND-03)');
  const disqV3 = res1.scenario_metrics.disqualified_vendors![0];
  assert(disqV3.vendor_id === 'VEND-03', 'Disqualified vendor is VEND-03');
  assert(disqV3.audit_score_pct === 52.0, 'Disqualified vendor audit score is 52.00%');
  assert(disqV3.reason.includes('ISO 9001'), 'Disqualification reason explicitly cites ISO 9001 failure');
  assert(res1.summary_markdown.includes('National Paper & Board Mills'), 'Markdown summary cites National Paper & Board Mills');
  assert(res1.summary_markdown.includes('52.00%'), 'Markdown summary cites 52.00% audit score');

  // Assert Line Allocations
  assert(res1.line_allocations !== undefined, 'Line allocations array is populated');
  assert(res1.line_allocations!.length === 30, 'Line allocations cover all 30 packaging items');
  assert(res1.highlight_cells.length === 30, 'Highlight cells contains exactly 30 winning cells');

  // Verify Vendor 3 won ZERO lines
  const v3Wins = res1.line_allocations!.filter((l) => l.winning_vendor_id === 'VEND-03');
  assert(v3Wins.length === 0, 'Disqualified Vendor 3 won zero line allocations');

  // Assert Mathematical Invariant: sum(allocated_spend) == total_spend
  let sumAllocated = 0;
  for (const a of res1.scenario_metrics.award_distribution) {
    sumAllocated += a.allocated_spend_inr;
  }
  const mathDiff = Math.abs(sumAllocated - res1.scenario_metrics.total_spend_inr);
  assert(mathDiff < 0.001, `Mathematical Invariant: Sum of allocations matches total spend (Diff: ${mathDiff})`);

  // =========================================================================
  // Test Group 3: Benchmark Query 2 - Buried Footnote Fees & Surcharge Audit
  // =========================================================================
  console.log('\n📋 Test Group 3: Benchmark Query 2 - Buried Footnote Fees & Ancillary Dissection');
  const q2 = 'Identify all buried footnote fees across suppliers';
  const ast2 = await parseCopilotQuery(q2);

  assert(ast2.intent === 'LIST_HIDDEN_TERMS', 'Q2 intent classified as LIST_HIDDEN_TERMS');
  const res2 = deterministicSolver.execute(ast2.intent, ast2.constraints);

  assert(res2.summary_markdown.includes('Packaging World India'), 'Surfaces VEND-01');
  assert(res2.summary_markdown.includes('₹25,000'), 'Surfaces VEND-01 ₹25,000 tooling fee');
  assert(res2.summary_markdown.includes('D34'), 'Cites VEND-01 source location Cell D34');
  assert(res2.summary_markdown.includes('Balaji Traders'), 'Surfaces VEND-05');
  assert(res2.summary_markdown.includes('+4.0% freight'), 'Surfaces VEND-05 +4% freight surcharge');
  assert(res2.summary_markdown.includes('Global Pack Holdings'), 'Surfaces VEND-04 foreign USD peg');
  assert(res2.summary_markdown.includes('per 100 pcs'), 'Surfaces VEND-02 /100 pcs scale');
  assert(res2.summary_markdown.includes('-4.2°'), 'Surfaces VEND-02 -4.2° skew angle');
  assert(res2.summary_markdown.includes('Omitted lines 21–27'), 'Surfaces VEND-03 partial bid omissions');
  assert(res2.highlight_cells.length > 0, 'Highlight cells populated for hidden surcharge rows');

  // =========================================================================
  // Test Group 4: Benchmark Query 3 - FX Sensitivity & Flipped Lines
  // =========================================================================
  console.log('\n📋 Test Group 4: Benchmark Query 3 - FX Sensitivity & Substitution Analysis');
  const q3 = 'Compare total landed spend if USD moves from 84 to 87 INR';
  const ast3 = await parseCopilotQuery(q3);

  assert(ast3.intent === 'FX_SENSITIVITY', 'Q3 intent classified as FX_SENSITIVITY');
  assert(ast3.constraints.exchange_rate_usd_inr === 87.0, 'Q3 extracted target rate 87.00 INR/USD');
  assert(ast3.constraints.baseline_exchange_rate_usd_inr === 84.0, 'Q3 baseline rate is 84.00 INR/USD');

  const res3 = deterministicSolver.execute(ast3.intent, ast3.constraints);

  assert(res3.fx_sensitivity_details !== undefined, 'FX sensitivity details present in response payload');
  assert(res3.fx_sensitivity_details!.vend04_portfolio_delta_inr > 0, 'VEND-04 unmitigated spend delta is positive (>0)');
  assert(res3.fx_sensitivity_details!.flipped_lines_count === 13, `Exactly 13 lines flip to domestic suppliers (Found: ${res3.fx_sensitivity_details!.flipped_lines_count})`);

  // Verify that every flipped line saves money by substituting domestic vendor vs new USD rate
  for (const f of res3.fx_sensitivity_details!.flipped_lines) {
    assert(
      f.domestic_rate_inr < f.new_usd_rate_inr,
      `Flipped line ${f.line_id}: Domestic rate (₹${f.domestic_rate_inr.toFixed(2)}) < Inflated USD rate (₹${f.new_usd_rate_inr.toFixed(2)})`
    );
    assert(f.substitution_savings_inr > 0, `Flipped line ${f.line_id}: Substitution savings > 0`);
  }

  // =========================================================================
  // Test Group 5: API Route POST /api/copilot/interrogate Contract
  // =========================================================================
  console.log('\n📋 Test Group 5: API Route POST /api/copilot/interrogate Contract Verification');
  const fakeRequest = new Request('http://localhost:3000/api/copilot/interrogate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'What is the cheapest split-award per line excluding vendors failing ISO quality?' }),
  });

  const apiResponse = await POST(fakeRequest);
  assert(apiResponse.status === 200, 'POST /api/copilot/interrogate returns HTTP 200 OK');

  const apiJson = await apiResponse.json();
  assert(apiJson.success === true, 'API response success is true');
  assert(apiJson.query_ast !== undefined, 'API response contains query_ast');
  assert(apiJson.query_ast.zero_arithmetic_verified === true, 'API response confirms zero arithmetic in token parsing');
  assert(apiJson.summary_markdown !== undefined, 'API response contains summary_markdown');
  assert(apiJson.scenario_metrics !== undefined, 'API response contains scenario_metrics');
  assert(apiJson.highlight_cells !== undefined, 'API response contains highlight_cells');
  assert(apiJson.highlight_cells.length === 30, 'API response highlights all 30 winning cells');

  // Test Bad Request Handling
  const badRequest = new Request('http://localhost:3000/api/copilot/interrogate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '' }),
  });
  const badResponse = await POST(badRequest);
  assert(badResponse.status === 400, 'Empty query returns HTTP 400 Bad Request');

  console.log('\n========================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} STEP 5 TESTS PASSED SUCCESSFULLY!`);
  console.log('========================================\n');
}

runStep5Tests().catch((err) => {
  console.error('\n❌ Step 5 verification failed:', err);
  process.exit(1);
});
