### 1. High-Level Architecture for Antigravity

```
                                  [ BUYER INTERFACE ]
                                           │
         ┌─────────────────────────────────┴─────────────────────────────────┐
         ▼                                                                   ▼
[ RFx Generator Co-Pilot ]                                      [ Dual-Pane Unified Workspace ]
(Natural language scope/terms)                                  ├─ Left: Side-by-Side Normalized Grid
         │                                                      └─ Right: NL Interrogation Copilot
         ▼                                                                   ▲
 [ Master RFx Schema ]                                                       │
 (30 Lines, INR, Single Box)                                                 │
         │                                                                   │
         ▼                                                                   │
[ Mock Ingestion Bridge ]                                                    │
(Upload 5 raw vendor files:                                                  │
 Excel, PDF, Word, Photo, Email)                                             │
         │                                                                   │
         ▼                                                                   │
┌─────────────────────────────────────────────────────────────────────────┐  │
│                   AI MULTI-MODAL EXTRACTION PIPELINE                    │  │
│  • Multi-modal parser (Vision/OCR + Text Layout Extraction)             │  │
│  • Entity Resolution: Maps vendor line descriptions to 30 master SKUs    │  │
│  • Metadata Capture: Page #, file hash, bounding boxes, literal strings │  │
└────────────────────────────────────┬────────────────────────────────────┘  │
                                     │ Raw Entities & Bounding Boxes         │
                                     ▼                                       │
┌─────────────────────────────────────────────────────────────────────────┐  │
│                DETERMINISTIC NORMALIZATION & GOVERNANCE                 │  │
│  • Unit Scaler: Converts /100 pcs, /kg to "per single box"              │  │
│  • Currency Engine: Applies fixed RFx peg (USD -> INR)                  │  │
│  • Footnote Amortizer: Adds freight % and amortizes tooling over volume │  │
│  • Dual-Axis Scorer: Computes Certainty (C) and Financial Exposure (E)  │  │
│  • Review Router: AUTO_VERIFIED vs. MANDATORY_BUYER_REVIEW              │  │
└────────────────────────────────────┬────────────────────────────────────┘  │
                                     │ Clean Normalized Data                 │
                                     ▼                                       │
┌─────────────────────────────────────────────────────────────────────────┐  │
│                  POSTGRESQL / SQLITE CANONICAL STORE                    │  │
│  • rfx_lines (sku, target_qty, specs)                                   │  │
│  • vendor_quotes (raw_val, norm_val, landed_cost, flags, source_coords) │──┘
│  • questionnaire_evals (iso_pass, payment_terms, audit_score)           │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Query Schema
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    NL COPILOT INTERROGATION ENGINE                      │
│  1. Intent Parser (LLM): Buyer prompt ──> Parameterized SQL / Solver AST│
│  2. Deterministic Solver (SQL/Python): Runs split-award LP optimization │
│  3. Narrative Formatter: Renders response tables & highlights UI cells  │
└─────────────────────────────────────────────────────────────────────────┘

```

#### Core Data Entities

* `rfx_master`: `id`, `category`, `baseline_currency` (`INR`), `created_at`.
* `rfx_line_items`: `id`, `sku_code`, `description`, `ply_type` (3-ply/5-ply), `target_volume`, `spec_weight_kg`.
* `vendor_quotes`: `id`, `vendor_id`, `line_item_id`, `raw_price`, `raw_unit`, `raw_currency`, `normalized_unit_price`, `landed_unit_cost`, `certainty_score`, `exposure_level`, `review_status`, `source_bounding_box`, `source_text_snippet`.
* `vendor_commercials`: `vendor_id`, `freight_terms`, `one_time_tooling_inr`, `payment_terms`, `iso_certified`, `audit_score`.
* `rfx_dispatches`: `id`, `rfx_id`, `vendor_id`, `recipient_email`, `reply_to_email`, `dispatch_token`, `status`, `dispatched_at`.

---

