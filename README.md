# Aerchain QuoteEngine

> **Enterprise Procurement Evaluation & RFx Interrogation Platform**
> AI Bootcamp Project · Built with Next.js 14, SQLite, TypeScript, and a deterministic copilot engine

---

## Table of Contents

1. [What This Is](#what-this-is)
2. [Quick Start](#quick-start)
3. [Architecture](#architecture)
4. [Database Schema](#database-schema)
5. [Vendor Profiles & Ingestion Modalities](#vendor-profiles--ingestion-modalities)
6. [API Reference](#api-reference)
7. [Procurement Copilot](#procurement-copilot)
8. [AI Evaluation Suite](#ai-evaluation-suite)
9. [Project Structure](#project-structure)
10. [Environment Variables](#environment-variables)
11. [Build Scripts](#build-scripts)

---

## What This Is

**Aerchain QuoteEngine** eliminates the multi-day manual quote reconciliation process in enterprise procurement. Given an RFx covering **30 corrugated packaging SKUs** and **5 vendor submissions** in wildly different formats, the system:

| Problem | What We Build |
|---------|--------------|
| Vendors submit quotes in Excel, scanned photo, Word, USD PDF, and raw email | **Multi-modal ingestion pipeline** that normalizes everything to `per_box / INR / landed cost` |
| Hidden plate fees, freight surcharges, and per-100-pcs unit mismatches distort pricing | **Deterministic normalization engine** with a `C × E` dual-axis certainty scorer |
| Buyers spend days building pivot tables for award decisions | **Natural language copilot** that runs split-award LP optimization, FX sensitivity, and compliance audits deterministically |
| LLM-generated numbers cannot be audited | **Zero arithmetic in token generation** — all math executes in TypeScript/SQL with full provenance trails |

**Total spend baseline:** ₹4,00,00,000 (₹4.0 Crore) across 30 line items.

---

## Quick Start

### Prerequisites

- Node.js 18+
- `tsx` (included as dev dependency)
- SQLite3 (bundled via `better-sqlite3`)

### Install & Run

```bash
# Install dependencies
npm install

# Run full DB pipeline (migrate → seed → ingest)
npm run db:migrate
npm run db:seed
npm run db:ingest

# Start development server
npm run dev
# → http://localhost:3000
```

### Run AI Eval Suite

```bash
npx tsx evals/copilot_eval_suite.ts
```

---

## Architecture

```
                          [ BUYER INTERFACE — Next.js App Router ]
                                          │
         ┌────────────────────────────────┴─────────────────────────────────┐
         ▼                                                                   ▼
[ Left Pane: Comparison Matrix ]                         [ Right Pane: Copilot Chat ]
  30 lines × 5 vendors                                    Natural language queries
  Landed Cost, Flags, Alerts                              Deterministic solver output
         │                                                         │
         └────────────────────┬──────────────────────────────────┘
                              ▼
                  [ Next.js API Routes (/api/*) ]
                              │
         ┌────────────────────┼───────────────────────┐
         ▼                    ▼                        ▼
  /api/quotes/matrix   /api/copilot/interrogate   /api/rfx/*
  (30×5 comparison)    (NL → AST → Solver)        (RFx dispatch)
         │                    │
         ▼                    ▼
  ┌──────────────────────────────────────────┐
  │         SQLite Canonical Store           │
  │  rfx_line_items · vendors               │
  │  vendor_line_quotes · vendor_ancillary  │
  │  rfx_master · rfx_dispatches           │
  └──────────────────────────────────────────┘
         ▲
         │
  ┌──────────────────────────────────────────┐
  │     Deterministic Normalization Engine   │
  │  Unit Scaler → Currency Converter        │
  │  Footnote Amortizer → C×E Scorer        │
  └──────────────────────────────────────────┘
         ▲
         │
  ┌──────────────────────────────────────────┐
  │    Multi-Modal Ingestion Pipeline        │
  │  Excel Parser · OCR Photo · PDF          │
  │  Email String Parser · Word Doc          │
  └──────────────────────────────────────────┘
```

### Copilot 2-Layer Architecture

```
Buyer NL Query
     │
     ▼
┌──────────────────────────────────────────────┐
│  Layer 1 — Intent Parser (intentParser.ts)   │
│  • Deterministic regex/keyword classifier    │
│  • LLM fallback (Gemini / OpenAI)           │
│  • Emits structured CopilotIntentAST (JSON) │
│  • ZERO arithmetic in token generation       │
└─────────────────────┬────────────────────────┘
                      │ Structured AST
                      ▼
┌──────────────────────────────────────────────┐
│  Layer 2 — Deterministic Solver              │
│  (deterministicSolver.ts)                    │
│  • SQL queries on SQLite                     │
│  • TypeScript LP optimization                │
│  • Full provenance, highlight coordinates   │
│  • Returns SolverResultPayload + markdown   │
└──────────────────────────────────────────────┘
                      │
                      ▼
          Structured Response + Cell Highlights
```

---

## Database Schema

| Table | Rows | Purpose |
|-------|------|---------|
| `rfx_master` | 1 | RFx configuration and metadata |
| `rfx_line_items` | 30 | Master SKU catalog (PKG-001 to PKG-030) |
| `vendors` | 5 | Vendor profiles and compliance data |
| `vendor_line_quotes` | 150 | Normalized quotes (30 lines × 5 vendors) |
| `vendor_ancillary_charges` | — | Hidden fees, plate charges, freight surcharges |
| `rfx_dispatches` | — | Email dispatch tracking |
| `schema_migrations` | — | Migration version control |

### Key Fields — `vendor_line_quotes`

| Field | Description |
|-------|-------------|
| `raw_numeric_value` | Original value as extracted (e.g. `4250.00`) |
| `raw_unit` | Original unit string (e.g. `per 100 pcs`, `per kg`) |
| `raw_currency` | `INR` or `USD` |
| `true_landed_unit_cost` | Final normalized `INR / box` including freight + tooling amortization |
| `extraction_certainty` | `C ∈ [0.0, 1.0]` OCR/extraction confidence score |
| `review_status` | `AUTO_VERIFIED` \| `FLAG_REVIEW_RECOMMENDED` \| `MANDATORY_BUYER_REVIEW` |
| `is_quoted` | `1` if vendor submitted this line, `0` if omitted |

---

## Vendor Profiles & Ingestion Modalities

| ID | Vendor | Format | Lines | ISO 9001 | Audit Score | Key Caveat |
|----|--------|--------|-------|----------|-------------|------------|
| `VEND-01` | Packaging World India | Multi-tab Excel | 30/30 | ✅ | 95% | ₹25,000 plate fee hidden in cell **D34** |
| `VEND-02` | Apex Cartons & Containers | Angled smartphone photo | 30/30 | ✅ | 88% | Rates in **`₹ per 100 pcs`** — must ÷ 100 |
| `VEND-03` | National Paper & Board Mills | Partial Word/PDF | 23/30 | ❌ | 52% | Omits lines 21–27 (die-cut mailers); **ISO FAILED** |
| `VEND-04` | Global Pack Holdings | Clean PDF in USD | 30/30 | ✅ | 96% | All rates in **USD** — FX risk at peg 84.00 |
| `VEND-05` | Balaji Traders | Raw email string | 30/30 | ✅ | 82% | Rates in **`₹/kg`** + **4% freight extra** |

### Normalization Rules

```
True Landed Unit Cost (INR/box) =
  (Base Rate INR × (1 + Freight Surcharge %))
  + (Fixed Ancillary Fee ÷ Line Target Volume)

VEND-01: rate_inr + (25000 / target_volume)          ← tooling amortization
VEND-02: (raw_value / 100)                             ← per-100 unit scaling
VEND-03: rate_inr (lines 21–27 → is_quoted = 0)       ← partial bid
VEND-04: raw_usd_value × 84.00                         ← FX conversion
VEND-05: spec_weight_kg × rate_per_kg × 1.04          ← kg rate + 4% freight
```

---

## API Reference

### `POST /api/copilot/interrogate`

Natural language query → deterministic solver result.

**Request:**
```json
{ "query": "What is the cheapest split-award per line, excluding failed quality questionnaire?" }
```

**Response:**
```json
{
  "intent": "OPTIMIZE_SPLIT_AWARD",
  "executive_summary": "...",
  "summary_markdown": "...",
  "scenario_metrics": {
    "total_spend_inr": 38379435.20,
    "baseline_spend_inr": 40000000,
    "savings_vs_baseline_inr": 1620564.80,
    "award_distribution": [...]
  },
  "line_allocations": [...],
  "highlight_cells": [{ "line_id": "PKG-001", "winning_vendor_id": "VEND-04" }]
}
```

### `GET /api/quotes/matrix`

Returns the full 30 × 5 comparison matrix with landed costs, flags, and review statuses.

### `POST /api/rfx/init`

Seeds master catalog and baseline RFx metadata.

### `POST /api/ingest/vendor`

Processes a vendor submission file and runs the normalization pipeline.

### `POST /api/webhooks/vendor-reply`

Handles inbound vendor email webhook responses.

---

## Procurement Copilot

The copilot understands **8 intent types** and handles **12 canonical benchmark scenarios** plus unlimited paraphrase variants.

### Supported Intent Types

| Intent | Example Query |
|--------|--------------|
| `OPTIMIZE_SPLIT_AWARD` | *"What is the cheapest split-award per line?"* |
| `COMPARE_LANDED_COST` | *"Who is the cheapest single-source vendor?"* |
| `LIST_HIDDEN_TERMS` | *"Identify all hidden ancillary fees and surcharges"* |
| `FX_SENSITIVITY` | *"Compare landed spend if USD strengthens to 87.00 INR"* |
| `AUDIT_VENDOR_COVERAGE` | *"Is Vendor 3 providing all materials?"* |
| `AUDIT_COMPLIANCE_TERMS` | *"Which vendors failed the mandatory ISO 9001 quality audit?"* |
| `EXPLAIN_NORMALIZATION` | *"How was Vendor 2's rate for PKG-001 normalized from the photo scan?"* |
| `UNKNOWN` | *(out-of-scope queries → guardrail response + suggestions)* |

### Benchmark Invariants

| Scenario | Expected Result |
|----------|----------------|
| Gated Split Award (excl. VEND-03) | Total spend ≈ **₹3,83,79,107** · Savings ≈ **₹16.2 Lakhs** |
| Single Source Best Vendor | **VEND-04** at ₹3,92,60,491 · VEND-03 disqualified (23/30 lines) |
| VEND-03 Coverage Audit | `is_complete: false` · **7 lines omitted** (PKG-021 → PKG-027) |
| FX Sensitivity @ 87.00 | VEND-04 portfolio drift **+₹~14 Lakhs** · Lines flip to domestic |
| Hidden Surcharges | VEND-01 ₹25,000 plate · VEND-05 +4% freight · VEND-02 ÷100 scaling |
| Payment Terms Deviations | VEND-01 Net 30 · VEND-05 Net 45 (baseline: Net 60) |

---

## AI Evaluation Suite

The eval suite lives in `evals/` and provides **automated regression testing** across the full copilot stack.

### Run the Suite

```bash
npx tsx evals/copilot_eval_suite.ts
```

### Latest Results — 46/46 PASSED ✅

```
═══════════════════════════════════════════════════════
  Aerchain Copilot Eval Suite · 46 tests · 5 groups
═══════════════════════════════════════════════════════

  A-Canonical       12/12 (100%)  ████████████
  B-Paraphrase      12/12 (100%)  ████████████
  C-Combinatorial    8/8  (100%)  ████████
  D-Guardrails       8/8  (100%)  ████████
  E-MathInvariant    6/6  (100%)  ██████

  ✓ ALL 46 TESTS PASSED — Zero Failures
```

### Test Group Descriptions

| Group | Count | What It Tests |
|-------|-------|--------------|
| **A — Canonical Benchmarks** | 12 | The 12 verbatim RFx specification queries with math invariant assertions |
| **B — Semantic Paraphrasing** | 12 | Diverse real-world phrasings that must route to the same intent without keyword-brittle failure |
| **C — Combinatorial Constraints** | 8 | Multi-constraint queries (FX + quality gate + concentration cap simultaneously) |
| **D — Negative Guardrails** | 8 | Out-of-domain queries (weather, cricket, SQL injection, prompt injection) must return `UNKNOWN` |
| **E — Math Invariants** | 6 | Solver-level assertions on exact spend figures, disqualification records, and FX deltas |

### Eval File Index

| File | Purpose |
|------|---------|
| [`evals/copilot_eval_suite.ts`](evals/copilot_eval_suite.ts) | Main executable test harness (46 cases) |
| [`evals/golden_dataset.json`](evals/golden_dataset.json) | Canonical golden dataset: all 46 test cases with expected AST outputs |
| [`evals/results/latest_run.json`](evals/results/latest_run.json) | Machine-readable output from the most recent eval run |
| [`evals/results/eval_history.md`](evals/results/eval_history.md) | Human-readable pass/fail history across runs |

---

## Project Structure

```
aerchain-quote-engine/
├── evals/                          # AI Evaluation Suite
│   ├── copilot_eval_suite.ts       # Main harness (46 test cases)
│   ├── golden_dataset.json         # Source of truth for expected AST outputs
│   └── results/
│       ├── latest_run.json         # Last run output (machine-readable)
│       └── eval_history.md         # Run history log
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── copilot/            # POST /api/copilot/interrogate
│   │   │   ├── matrix/             # GET /api/quotes/matrix
│   │   │   ├── quotes/             # Quote management endpoints
│   │   │   ├── rfx/                # RFx init and dispatch
│   │   │   └── webhooks/           # Vendor reply webhook
│   │   ├── layout.tsx
│   │   └── page.tsx                # Main dual-pane UI
│   │
│   ├── components/
│   │   ├── copilot/                # CopilotPane (chat UI)
│   │   ├── matrix/                 # Quote comparison grid
│   │   └── rfx/                    # RFx dispatch components
│   │
│   └── lib/
│       ├── copilot/
│       │   ├── intentParser.ts     # Layer 1: NL → Structured AST
│       │   └── deterministicSolver.ts  # Layer 2: AST → Results
│       ├── db.ts                   # SQLite connection + WAL config
│       ├── formatters.ts           # INR formatting (Indian numbering)
│       ├── catalogService.ts       # RFx line item catalog
│       └── inboundExtractionService.ts  # Vendor quote extraction
│
├── steps/                          # Sequential build pipeline scripts
│   ├── step_1/                     # migrate.ts · seed.ts · verify.ts
│   ├── step_2/                     # ingest.ts · verify_step2.ts
│   ├── step_3/                     # test_integration.ts
│   ├── step_4/                     # (RFx dispatch)
│   ├── step_5/                     # test_interrogation.ts
│   ├── step_6/                     # test_step6.ts
│   ├── step_copilot_audit/         # Copilot audit scripts
│   └── step_email_flow/            # Email flow tests
│
├── data/
│   └── aerchain.db                 # SQLite database (WAL mode)
│
├── scripts/
│   └── export_csv.ts               # Export quotes to CSV
│
├── BENCHMARK_AUDIT.md              # 12 canonical benchmark scenarios spec
├── DECISIONS_AND_SCOPE.md          # Design decisions and scope limits
├── HIGH_LEVEL_ARCHITECTURE.md      # System architecture diagrams
├── LOW_LEVEL_ARCHITECTURE.md       # Detailed component specs
├── PROJECT_CONTEXT.md              # Domain context and vendor profiles
├── PROMPTS.md                      # Build prompts used in Antigravity IDE
├── SYSTEM_PROMPT.md                # Copilot system prompt
├── PROCURER_GUIDE.md               # End-user guide for procurement buyers
└── package.json
```

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
# Optional: Enables LLM-based intent parsing (deterministic fallback used if absent)
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here   # Alternative to Gemini

# Optional: Email dispatch
SENDGRID_API_KEY=your_sendgrid_api_key_here
```

> **Note:** The copilot is fully functional without any API keys. The deterministic regex parser handles all 12 canonical scenarios and 46 eval test cases with 100% accuracy.

---

## Build Scripts

```bash
npm run dev                 # Start Next.js dev server
npm run build               # Full production build (migrate + seed + ingest + next build)

npm run db:migrate          # Run schema migrations
npm run db:seed             # Seed 30 line items and 5 vendor profiles
npm run db:ingest           # Run vendor quote ingestion pipeline
npm run db:verify           # Verify DB state after seeding
npm run db:verify:step2     # Verify ingestion pipeline output
npm run db:export           # Export quote matrix to CSV

npm run test:step3          # Integration tests (Step 3)
npm run test:step5          # Interrogation tests (Step 5)
npm run test:step6          # End-to-end tests (Step 6)
npm run test:email-flow     # Email flow tests

# AI Eval Suite
npx tsx evals/copilot_eval_suite.ts
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **SQLite over PostgreSQL** | Zero-infra demo setup; WAL mode gives safe concurrent reads |
| **Deterministic regex parser as primary** | 100% uptime guarantee — no LLM latency or API quota in demo |
| **LLM as optional enhancement layer** | Gemini/OpenAI provide richer paraphrase handling when available |
| **No LLM arithmetic** | Prevents hallucinated cost figures in procurement decisions — all math in TypeScript/SQL |
| **`true_landed_unit_cost` as canonical field** | Single source of truth; all normalization transforms applied before storage |
| **`C × E` dual-axis review routing** | High spend + low OCR confidence = `MANDATORY_BUYER_REVIEW` before any award |

---

*Built for the AI Bootcamp · Aerchain QuoteEngine · September 2026*
