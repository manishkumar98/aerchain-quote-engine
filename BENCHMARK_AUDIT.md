Run a comprehensive diagnostic and remediation pass on the Procurement Copilot across `src/lib/copilot/intentParser.ts`, `src/lib/copilot/deterministicSolver.ts`, and `src/components/copilot/CopilotPane.tsx`.

The copilot must deterministically handle all 12 canonical questions derived directly from the Aerchain brief. Do NOT fake calculations or generate mathematical tokens via LLM. Layer 1 maps intent to structured AST; Layer 2 executes deterministic SQL and TypeScript solvers.

---

### 1. The 12 Canonical Brief Benchmark Scenarios

Ensure the engine recognizes and accurately solves all 12 queries:

1. GATED_SPLIT: "What is the cheapest split-award per line, excluding failed quality questionnaire?"
   - Rule: Disqualifies VEND-03 (ISO failure, 52% audit score). Allocates line-by-line across V1, V2, V4, V5.
   - Assert: Total landed spend = ₹3,83,79,107.20 (₹3.84 Cr), Savings = ₹16,20,892.80 vs ₹4.0 Cr baseline.

2. SINGLE_SOURCE: "Who is the cheapest single-source vendor across all lines?"
   - Rule: Evaluates 100% basket allocation across eligible suppliers. Explicitly disqualifies VEND-03 (incomplete bid, only 23/30 lines).
   - Assert: Winner is VEND-04 (Global Pack Holdings) at ₹3,92,60,491.20. Identifies VEND-01 as runner-up.

3. CONCENTRATION_LIMIT: "What is the optimal split if no single vendor can receive more than 50% of total spend?"
   - Rule: Constrained linear allocation where max supplier share <= 0.50 * Total Spend.

4. CATEGORY_AWARD: "Award each packaging category to a single best vendor"
   - Rule: Solves 4 distinct winner groups (5-Ply Master, 3-Ply Universal, Die-Cut Mailers, Ancillary Protective) instead of individual lines.

5. HIDDEN_SURCHARGES: "Identify all hidden ancillary fees and surcharges across all suppliers"
   - Rule: Surfaces VEND-01's ₹25,000 plate fee (Excel cell D34), VEND-05's +4% freight surcharge (email body), and VEND-02's /100 pcs unit scaling.

6. TOOLING_AMORTIZATION: "How much does Vendor 1's one-time tooling charge add to the per-box price?"
   - Rule: Computes ₹25,000 / 1,458,000 total volume = +₹0.017/box amortized landed impact.

7. NORMALIZATION_PROVENANCE: "How was Vendor 2's rate for PKG-001 normalized from the photo scan?"
   - Rule: Returns audit trace: Raw quoted `₹4,250.00 / 100 pcs` -> Scale factor `0.01` -> Canonical rate `₹42.50 / box`. Cites coordinate bounding box [142, 380].

8. INCOTERMS_FREIGHT: "Which vendors quoted ex-works versus delivered (DDP)?"
   - Rule: Audits logistics terms. Surfaces VEND-01 (Ex-works Bhiwandi) and VEND-05 (4% freight extra) vs VEND-02/VEND-04 (Delivered terms).

9. COVERAGE_AUDIT: "Is Vendor 3 providing all materials?" (or "Which suppliers submitted partial bids?")
   - Rule: Queries SQLite line coverage. Returns direct "No", cites 23/30 lines quoted (76.7%), lists the 7 omitted items (PKG-021 to PKG-027), and highlights lines 21-27.

10. QUALITY_AUDIT: "Which vendors failed the mandatory ISO 9001 quality audit?"
    - Rule: Surfaces VEND-03 (Status: Not Certified / Under Renewal, Audit Score: 52.00% vs 70.00% gate).

11. PAYMENT_TERMS: "Which vendors deviated from our baseline Net 60 commercial terms?"
    - Rule: Surfaces VEND-01 (Quoted Net 30 Days) and VEND-05 (Quoted 45 Days).

12. FX_SENSITIVITY: "Compare landed spend if USD strengthens to 87.00 INR"
    - Rule: Recalculates VEND-04 at 87.00 INR/USD peg. Quantifies portfolio-level exposure (+₹14.02 Lakhs) and identifies the 13 line items that flip to domestic suppliers.

---

### 2. Implementation Steps for Any Missing Capabilities

1. Expand Intent Types in `src/lib/copilot/intentParser.ts`:
   Ensure `CopilotIntentType` covers:
   `'OPTIMIZE_SPLIT_AWARD' | 'COMPARE_LANDED_COST' | 'LIST_HIDDEN_TERMS' | 'FX_SENSITIVITY' | 'AUDIT_VENDOR_COVERAGE' | 'AUDIT_COMPLIANCE_TERMS' | 'EXPLAIN_NORMALIZATION' | 'UNKNOWN'`

2. Extend Heuristic Matching:
   Add regex routes for:
   - Tooling/Normalization: `/(?:how\s+was.*normalized|tooling.*add|plate.*amortiz|provenance)/i` -> `EXPLAIN_NORMALIZATION`
   - Terms/Incoterms/Payment: `/(?:payment\s+terms|deviated.*net\s*60|ex-works|freight.*extra|incoterms?|who.*failed.*iso)/i` -> `AUDIT_COMPLIANCE_TERMS`
   - Ensure `UNKNOWN` strictly catches unsupported queries without falling back to `OPTIMIZE_SPLIT_AWARD`.

3. Implement Missing Solvers in `src/lib/copilot/deterministicSolver.ts`:
   - `solveExplainNormalization(lineId, vendorId)`: Pulls arithmetic trail, conversion factor, and bounding boxes.
   - `solveAuditComplianceTerms(subType)`: Queries DB compliance questionnaire and ancillary terms, returning clear tables for payment terms, ISO gates, and freight clauses.
   - `solveSingleSource()`: Returns 100% basket totals while checking `is_quoted` completeness.

4. Update Collapsible Top Banner in `src/components/copilot/CopilotPane.tsx`:
   Ensure the top "Questions Copilot Can Answer" card includes quick-launch pills for the top categories (Award Optimization, Compliance & Coverage, Hidden Fees & Normalization, FX Sensitivity).

---

### 3. Automated Test Suite Script

Create and execute `steps/step_copilot_audit/test_all_12_queries.ts`:
Run all 12 exact strings through `parseIntent()` and the solver. Assert:
- Every query returns HTTP 200 with non-empty `executive_summary`.
- No query triggers unhandled exceptions or unintended `OPTIMIZE_SPLIT_AWARD` fallback.
- Math results match the exact benchmark invariants.