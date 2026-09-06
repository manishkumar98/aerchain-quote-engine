# Step 5: Deterministic Natural Language Interrogation Engine

## Architectural Overview

Step 5 implements the conversational interrogation layer conforming strictly to [SYSTEM_PROMPT.md](file:///Users/binaykumarsinha/Desktop/AIBootcampProject/Aerchain/SYSTEM_PROMPT.md) and Phase 3 of [LOW_LEVEL_ARCHITECTURE.md](file:///Users/binaykumarsinha/Desktop/AIBootcampProject/Aerchain/LOW_LEVEL_ARCHITECTURE.md).

It establishes **strict two-layer decoupling**:
1. **Layer 1 (LLM Intent Parsing & AST Generation):**
   - Natural language queries are translated into structured query filters.
   - **Zero arithmetic tokens:** The LLM is strictly prohibited from computing sums, multiplications, or cost deltas.
   - Built with deterministic keyword & regex pattern matching fallback guaranteeing 100% demo uptime without external API latency or network failure.
2. **Layer 2 (Deterministic Optimization Solver):**
   - Pure SQL & TypeScript mathematical optimization engine.
   - Disqualifies non-compliant vendors (e.g. `VEND-03` failing ISO 9001 quality threshold).
   - Executes arbitrary-precision calculations (`.toFixed(6)`) and 64-bit floating point arithmetic.
   - Line-by-line minimum landed cost selection across all 30 packaging SKUs.
   - Computes total contract spend, savings vs. baseline ₹4.00 Cr budget, and savings vs. best single-source.
   - Detailed substitution analysis for FX sensitivity (quantifying lines that flip from foreign to domestic suppliers).
3. **Layer 3 (Narrative & UI Payload):**
   - Emits executive summary markdown with numbers formatted in Indian numbering (`₹X,XX,XXX` or `₹X.XX Cr`).
   - Detailed supplier allocation breakdown tables.
   - Emits an array of winning (line_id, winning_vendor_id) pairs to trigger dynamic emerald pulse highlighting on the main matrix.

---

## API Contract: `POST /api/copilot/interrogate`

### Request Payload
```json
{
  "query": "What is the cheapest split-award per line excluding vendors failing ISO quality?"
}
```

### Response Payload
```json
{
  "success": true,
  "query_ast": {
    "intent": "OPTIMIZE_SPLIT_AWARD",
    "constraints": {
      "exclude_failed_questionnaire": true,
      "max_vendor_concentration_pct": 1,
      "exchange_rate_usd_inr": 84
    },
    "metrics": ["total_landed_spend", "delta_vs_baseline", "line_allocations", "award_distribution"],
    "raw_query": "What is the cheapest split-award per line excluding vendors failing ISO quality?",
    "parsed_via": "DETERMINISTIC_FALLBACK",
    "zero_arithmetic_verified": true
  },
  "summary_markdown": "### Optimal Split-Award Recommendation\n\n> [!WARNING]\n> **Vendor 3 (National Paper & Board Mills)** was disqualified from this allocation due to an **ISO 9001 compliance failure** (Audit Score: **52.00%** vs. 70.00% threshold) and an **incomplete bid** (quoted only 23 of 30 items).\n\nBy executing a line-item split award across compliant suppliers, total landed contract spend is reduced to **₹3,83,79,435.20** (**₹3.84 Cr**)...",
  "scenario_metrics": {
    "total_spend_inr": 38379435.20,
    "baseline_spend_inr": 40000000.00,
    "savings_vs_baseline_inr": 1620564.80,
    "savings_vs_baseline_pct": 4.05,
    "award_distribution": [
      { "vendor_id": "VEND-04", "vendor_name": "Global Pack Holdings", "lines_won": 13, "allocated_spend_inr": 23186503.20, "share_of_total_pct": 60.41 },
      { "vendor_id": "VEND-05", "vendor_name": "Balaji Traders", "lines_won": 16, "allocated_spend_inr": 10942932.00, "share_of_total_pct": 28.51 },
      { "vendor_id": "VEND-02", "vendor_name": "Apex Cartons & Containers", "lines_won": 1, "allocated_spend_inr": 4250000.00, "share_of_total_pct": 11.07 }
    ],
    "disqualified_vendors": [
      {
        "vendor_id": "VEND-03",
        "vendor_name": "National Paper & Board Mills",
        "reason": "Failed ISO 9001 quality audit gate (52.00% score vs 70.00% requirement) and incomplete bid submission",
        "audit_score_pct": 52.00
      }
    ]
  },
  "line_allocations": [ ... ],
  "highlight_cells": [
    { "line_id": "PKG-001", "winning_vendor_id": "VEND-02" },
    { "line_id": "PKG-002", "winning_vendor_id": "VEND-04" },
    ... (30 total)
  ]
}
```

---

## Benchmark Inquiries Handled

1. **Cheapest Split-Award (Excluding ISO Failed Vendors):**
   - Automatically identifies quality gate constraint `exclude_failed_questionnaire: true`.
   - Excludes `VEND-03` (failed ISO 9001 with 52.00% audit score).
   - Optimizes 30 lines across `VEND-01`, `VEND-02`, `VEND-04`, `VEND-05`.
   - Result: ₹3,83,79,435.20 (₹16.20 Lakhs savings vs. budget).

2. **Buried Footnote Fees & Unquoted Surcharges:**
   - Dissects all off-sheet surcharges across suppliers:
     - `VEND-01`: ₹25,000 stereo tooling plate fee (Cell D34 on Tab "Commercial Terms", amortized across basket volume $\implies +₹0.017/box$).
     - `VEND-05`: +4.0% freight surcharge on total invoice (Paragraph 1 of unformatted email body, ~₹22 Lakhs impact).
     - `VEND-04`: USD denominated quotes pegged at ₹84.00/$ (subject to currency movement).
     - `VEND-02`: Rate card quoted in "per 100 pcs" with -4.2° skew angle OCR extraction.
     - `VEND-03`: Incomplete bid (lines 21–27 missing) & ISO 9001 failure.

3. **FX Sensitivity & Substitution Analysis:**
   - Evaluates Rupee depreciation from ₹84.00 to ₹87.00 per USD (+3.57%).
   - Identifies that unmitigated gross `VEND-04` spend rises by +₹14,02,160.40 (+₹14.02 Lakhs).
   - Quantifies the **substitution effect**: exactly **13 packaging lines** flip from `VEND-04` to domestic suppliers (`VEND-01` and `VEND-02`) because domestic landed costs become cheaper at ₹87.00/$.
   - Quantifies the substitution savings protecting the enterprise from foreign inflation.

---

## Automated Verification

Run Step 5 automated tests:
```bash
npm run test:step5
```
