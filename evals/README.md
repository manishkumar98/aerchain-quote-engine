# Aerchain Copilot — Evaluation Suite

This folder contains the full AI evaluation framework for the Aerchain Procurement Copilot.

## Quick Run

```bash
npx tsx evals/copilot_eval_suite.ts
```

**Current status: ✅ 46/46 PASS (100%)**

---

## File Index

```
evals/
├── copilot_eval_suite.ts       # Executable test harness (46 test cases)
├── golden_dataset.json         # Source-of-truth expected outputs for all 46 cases
├── README.md                   # This file
└── results/
    ├── latest_run.json         # Machine-readable output of most recent run
    └── eval_history.md         # Human-readable log of all runs and regressions
```

---

## Test Groups

| Group | Cases | Focus |
|-------|-------|-------|
| **A — Canonical** | 12 | The 12 verbatim RFx benchmark queries with math assertions |
| **B — Paraphrase** | 12 | Varied real-world phrasing that must route correctly |
| **C — Combinatorial** | 8 | Multi-constraint queries (FX + quality gate + concentration cap) |
| **D — Guardrails** | 8 | Out-of-scope queries must strictly return `UNKNOWN` |
| **E — Math Invariants** | 6 | Solver-level exact number assertions |

---

## What Each File Tests

### `copilot_eval_suite.ts`
- Calls `parseIntentDeterministic()` on each query
- Asserts `intent`, `constraints`, and `is_fallback` fields
- For math invariant cases, calls `solver.execute()` and checks output values
- Prints a pass/fail table to stdout; exits with code `1` if any test fails

### `golden_dataset.json`
The canonical reference for what every query *should* produce:
- `expected_intent` — the correct `CopilotIntentType`
- `expected_constraints` — field-level constraint assertions
- `math_invariant_description` — human-readable description of solver checks
- `_meta.math_invariants` — exact numeric benchmarks (spend totals, vendor IDs, line counts)

### `results/latest_run.json`
Machine-readable per-test results updated after each run. Fields:
- `status`: `"PASS"` | `"FAIL"`
- `intent_match`: boolean
- `constraint_match`: boolean
- `math_match`: boolean | null
- `math_detail`: string description of the invariant check result

### `results/eval_history.md`
Human-readable chronological log of every eval run — includes failure root causes and the patches applied to fix them.

---

## Adding New Test Cases

1. Add the case to `copilot_eval_suite.ts` in the `testCases` array with a new ID (continue the sequence)
2. Add the corresponding entry to `golden_dataset.json`
3. Run the suite: `npx tsx evals/copilot_eval_suite.ts`
4. Update `results/eval_history.md` with the new run result

---

## Benchmark Invariants

These hard numbers are the ground truth for the RFx evaluation:

| Scenario | Expected Value |
|----------|---------------|
| Split award total spend (excl. VEND-03) | ₹3,83,79,107 ± ₹1,000 |
| Best single-source vendor | VEND-04 (Global Pack Holdings) |
| Best single-source spend | ₹3,92,60,491 ± ₹5,000 |
| VEND-03 quoted lines | 23 / 30 |
| VEND-03 omitted lines | PKG-021 through PKG-027 (7 lines) |
| VEND-03 ISO audit score | 52% (threshold: 70%) |
| VEND-04 FX delta @ 87.00 | +₹~14 Lakhs (₹1.0M – ₹2.0M range) |
| Payment term deviants | VEND-01 (Net 30), VEND-05 (Net 45); baseline Net 60 |
| OCR normalization — VEND-02 PKG-001 | ₹4,250/100 pcs → ₹42.50/box; bounding box [142, 380] |
| Tooling amortization — VEND-01 | ₹25,000 / 1,458,000 units = +₹0.017/box |
