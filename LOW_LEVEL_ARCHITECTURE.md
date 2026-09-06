Save the following content as `LOW_LEVEL_ARCHITECTURE.md` in the root of your project directory for Antigravity.

```markdown
# LOW_LEVEL_ARCHITECTURE: Aerchain QuoteEngine

This specification outlines the data schemas, deterministic mathematical transformations, API contracts, extraction pipelines, and UI state boundaries required to build the autonomous RFx ingestion and interrogation engine.

---

## Phase 1: Canonical Data Model & Storage Schema

Use SQLite (via Drizzle ORM / Prisma) or PostgreSQL. All financial and unit rates must strictly use arbitrary-precision numbers (`NUMERIC(18, 6)` or `DECIMAL(18, 6)`).

```sql
-- 1. Master RFx Catalog (Single Source of Truth)
CREATE TABLE rfx_master (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Corrugated Packaging',
    baseline_currency TEXT NOT NULL DEFAULT 'INR',
    usd_peg_rate NUMERIC(10, 4) NOT NULL DEFAULT 84.0000,
    total_target_budget NUMERIC(18, 2) NOT NULL DEFAULT 40000000.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 30 Canonical Line Items
CREATE TABLE rfx_line_items (
    id TEXT PRIMARY KEY,               -- e.g., 'PKG-001'
    rfx_id TEXT REFERENCES rfx_master(id),
    line_number INTEGER NOT NULL,      -- 1 to 30
    sku_name TEXT NOT NULL,
    spec_category TEXT NOT NULL,       -- '5-Ply Master', '3-Ply Universal', 'Die-Cut Mailer', 'Protective'
    dimensions TEXT NOT NULL,          -- e.g., '500x350x300mm'
    spec_weight_kg NUMERIC(8, 4) NOT NULL, -- Nominal box weight for /kg conversions
    target_volume INTEGER NOT NULL,    -- Required production quantity
    baseline_benchmark_price NUMERIC(18, 4) NOT NULL
);

-- 3. Supplier Profiles & Compliance Data
CREATE TABLE vendors (
    id TEXT PRIMARY KEY,               -- 'VEND-01' to 'VEND-05'
    name TEXT NOT NULL,
    inbound_modality TEXT NOT NULL,    -- 'MULTI_TAB_EXCEL', 'ANGLED_PHOTO', 'PARTIAL_WORD', 'FOREIGN_USD_PDF', 'RAW_EMAIL'
    raw_document_url TEXT NOT NULL,
    doc_sha256 TEXT NOT NULL,
    iso_9001_certified BOOLEAN NOT NULL DEFAULT FALSE,
    fsc_certified BOOLEAN NOT NULL DEFAULT FALSE,
    credit_terms TEXT NOT NULL,        -- 'Net 60', 'Net 30', 'Net 15', 'Advance'
    quality_audit_score NUMERIC(5, 2) NOT NULL -- 0 to 100
);

-- 4. Extracted & Normalized Line-Item Quotes
CREATE TABLE vendor_line_quotes (
    id TEXT PRIMARY KEY,
    rfx_line_item_id TEXT REFERENCES rfx_line_items(id),
    vendor_id TEXT REFERENCES vendors(id),
    is_quoted BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Raw Ingestion Layer (Immutable)
    raw_price_string TEXT,             -- Literal string from OCR/Doc: "₹4,200 / 100 pcs"
    raw_numeric_value NUMERIC(18, 4),  -- 4200.00
    raw_unit TEXT,                     -- 'per 100 pcs', 'kg', 'box', 'USD'
    raw_currency TEXT DEFAULT 'INR',
    
    -- Normalization Layer
    canonical_unit TEXT DEFAULT 'per_box',
    unit_conversion_factor NUMERIC(12, 6) NOT NULL DEFAULT 1.000000,
    normalized_base_price_inr NUMERIC(18, 6), -- Converted to single unit INR
    
    -- True Landed Cost Layer
    freight_surcharge_pct NUMERIC(6, 4) DEFAULT 0.0000, -- e.g., 0.0400 for 4%
    amortized_tooling_inr NUMERIC(18, 6) DEFAULT 0.0000, -- (Fixed Tooling / Target Volume)
    payment_term_penalty_inr NUMERIC(18, 6) DEFAULT 0.0000,
    true_landed_unit_cost NUMERIC(18, 6), -- Final figure for rankings & scenario calculations
    
    -- Confidence & Governance Matrix
    signal_confidence NUMERIC(4, 3) NOT NULL, -- S_signal: OCR/Parse quality (0.0 to 1.0)
    spec_confidence NUMERIC(4, 3) NOT NULL,   -- S_spec: Unit conversion risk (0.0 to 1.0)
    sanity_confidence NUMERIC(4, 3) NOT NULL, -- S_sanity: Median benchmark proximity (0.0 to 1.0)
    composite_certainty NUMERIC(4, 3) NOT NULL, -- Composite score C
    financial_exposure TEXT NOT NULL,         -- 'HIGH', 'MEDIUM', 'LOW'
    review_status TEXT NOT NULL DEFAULT 'AUTO_VERIFIED', -- 'AUTO_VERIFIED', 'FLAG_REVIEW_RECOMMENDED', 'MANDATORY_BUYER_REVIEW', 'BUYER_CONFIRMED'
    
    -- Bounding-Box & Source Provenance
    source_page_number INTEGER DEFAULT 1,
    source_bounding_box JSON,                 -- { "x": 120, "y": 340, "w": 210, "h": 45 }
    source_snippet_text TEXT,
    human_override_reason TEXT,
    reviewed_at TIMESTAMP
);

-- 5. Off-Sheet Vendor Ancillary Fees
CREATE TABLE vendor_ancillary_charges (
    id TEXT PRIMARY KEY,
    vendor_id TEXT REFERENCES vendors(id),
    fee_type TEXT NOT NULL,                   -- 'TOOLING_PLATE_FEE', 'FREIGHT_SURCHARGE', 'MINIMUM_ORDER_PENALTY'
    fee_scope TEXT NOT NULL,                  -- 'BASKET_FIXED', 'PERCENTAGE_ON_TOTAL', 'PER_LINE'
    raw_quoted_text TEXT NOT NULL,
    amount_inr NUMERIC(18, 2) DEFAULT 0.00,
    percentage_value NUMERIC(6, 4) DEFAULT 0.0000,
    source_location_ref TEXT                  -- e.g., 'Cell D34 on Tab "Terms"' or 'Footnote 2'
);

-- 6. Asymmetric RFx Email Dispatches
CREATE TABLE rfx_dispatches (
    id TEXT PRIMARY KEY,
    rfx_id TEXT REFERENCES rfx_master(id),
    vendor_id TEXT REFERENCES vendors(id),
    recipient_email TEXT NOT NULL,
    reply_to_email TEXT NOT NULL,
    dispatch_token TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DELIVERED',
    dispatched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Phase 2: Ingestion Pipeline & Normalization Math Engine

The ingestion pipeline transforms multi-modal supplier files into canonical database entries.

```
[ Inbound Raw Document ]
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Multi-Modal Vision & Layout Parser (FastAPI / Gemini API) │
│   - Image / PDF / Doc parsing                               │
│   - Extracts: line identifier, raw rate, raw unit, clauses  │
│   - Emits bounding box coordinates: [x, y, w, h]            │
└──────────────────────────────┬──────────────────────────────┘
                               │ Structured JSON Stream
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Deterministic Normalization Worker (Python / TypeScript)  │
│   - Rule A: Unit Scaling                                    │
│   - Rule B: Currency Conversion                             │
│   - Rule C: Footnote Loading (True Landed Cost)             │
│   - Rule D: Governance Scoring (C x E Matrix)               │
└──────────────────────────────┬──────────────────────────────┘
                               │ Canonical Rows
                               ▼
              [ PostgreSQL / SQLite Database ]

```

### Mathematical Normalization Rules

#### Rule A: Unit Normalization to `per_box`

1. If `raw_unit` == `'per 100 pcs'`:

$$\text{unit\_conversion\_factor} = 0.010000$$


$$\text{normalized\_base} = \text{raw\_price} \times 0.010000$$


2. If `raw_unit` == `'per kg'`:

$$\text{normalized\_base} = \text{raw\_price} \times \text{rfx\_line\_items.spec\_weight\_kg}$$


3. If `raw_unit` == `'per box'` or `'each'`:

$$\text{normalized\_base} = \text{raw\_price} \times 1.000000$$



#### Rule B: Currency Conversion

If `raw_currency` == `'USD'`:


$$\text{normalized\_base\_price\_inr} = \text{normalized\_base} \times \text{rfx\_master.usd\_peg\_rate (84.0000)}$$

#### Rule C: True Landed Cost Allocation

$$\text{amortized\_tooling} = \frac{\text{vendor\_ancillary\_charges.amount\_inr}}{\sum (\text{rfx\_line\_items.target\_volume})}$$

$$\text{true\_landed\_unit\_cost} = (\text{normalized\_base\_price\_inr} \times (1 + \text{freight\_surcharge\_pct})) + \text{amortized\_tooling}$$

#### Rule D: Governance Matrix Scoring ($C \times E$)

Calculate Extraction Certainty ($C$):


$$C = (0.35 \times S_{\text{signal}}) + (0.35 \times S_{\text{sanity}}) + (0.30 \times S_{\text{spec}})$$

* $S_{\text{signal}}$: Native Excel = $1.0$; Clean PDF = $0.95$; Skewed Image = $0.80$; Free Email = $0.65$.
* $S_{\text{sanity}}$: Given $\Delta = \frac{|\text{normalized\_base} - \text{median\_peer\_bid}|}{\text{median\_peer\_bid}}$:
* If $\Delta \le 0.15 \implies S_{\text{sanity}} = 1.0$
* If $0.15 < \Delta \le 0.35 \implies S_{\text{sanity}} = 0.60$
* If $\Delta > 0.35 \implies S_{\text{sanity}} = 0.20$


* $S_{\text{spec}}$: Direct unit match = $1.0$; Scaled `/100` = $0.85$; Derived weight `/kg` = $0.65$; Ambiguous = $0.20$.

Calculate Financial Exposure ($E$):


$$W_i = \frac{\text{target\_volume}_i \times \text{baseline\_benchmark\_price}_i}{\text{total\_target\_budget}}$$

* $E = \text{'HIGH'}$ if $W_i \ge 0.05$ ($5\%$ of contract spend)
* $E = \text{'MEDIUM'}$ if $0.02 \le W_i < 0.05$
* $E = \text{'LOW'}$ if $W_i < 0.02$

**Review Status Assignment:**

* If $C < 0.60 \implies \text{'MANDATORY\_BUYER\_REVIEW'}$
* If $E == \text{'HIGH'}$ and $C < 0.90 \implies \text{'MANDATORY\_BUYER\_REVIEW'}$
* If $E == \text{'MEDIUM'}$ and $C < 0.75 \implies \text{'MANDATORY\_BUYER\_REVIEW'}$
* Else $\implies \text{'AUTO\_VERIFIED'}$

---

## Phase 3: Core API Endpoints

### 1. Unified Grid Matrix Endpoint

* **Endpoint:** `GET /api/matrix`
* **Response Payload:**

```json
{
  "rfx_id": "RFX-2026-CORR",
  "total_budget_inr": 40000000.00,
  "lines": [
    {
      "line_id": "PKG-001",
      "sku_name": "5-Ply Heavy Master Shipper (600x400x400mm)",
      "spec_weight_kg": 1.15,
      "target_volume": 100000,
      "quotes": {
        "VEND-01": {
          "raw_display": "₹45.00 / box",
          "landed_cost_inr": 45.416,
          "has_footnotes": true,
          "footnote_detail": "₹25k tooling fee amortized (+₹0.416/box)",
          "review_status": "AUTO_VERIFIED",
          "certainty_score": 0.98
        },
        "VEND-02": {
          "raw_display": "₹4,250 / 100 pcs",
          "landed_cost_inr": 42.500,
          "has_footnotes": false,
          "review_status": "MANDATORY_BUYER_REVIEW",
          "certainty_score": 0.88,
          "flag_reason": "High Spend Line (>5%) with OCR conversion from angled scan"
        },
        "VEND-03": {
          "raw_display": "NOT QUOTED",
          "landed_cost_inr": null,
          "review_status": "EXCLUDED",
          "certainty_score": 0.0
        },
        "VEND-04": {
          "raw_display": "$0.51 / box",
          "landed_cost_inr": 42.840,
          "has_footnotes": true,
          "footnote_detail": "Converted @ 84.00 INR/USD peg",
          "review_status": "AUTO_VERIFIED",
          "certainty_score": 0.94
        },
        "VEND-05": {
          "raw_display": "₹44.00 / kg",
          "landed_cost_inr": 52.624,
          "has_footnotes": true,
          "footnote_detail": "Spec derived (1.15kg) + 4% freight surcharge",
          "review_status": "AUTO_VERIFIED",
          "certainty_score": 0.82
        }
      }
    }
  ]
}

```

### 2. Provenance Drawer Detail Endpoint

* **Endpoint:** `GET /api/quotes/:quote_id/provenance`
* **Response Payload:**

```json
{
  "quote_id": "QUOTE-V2-PKG-001",
  "vendor_name": "Apex Cartons & Containers",
  "document_name": "apex_rate_card_scan.jpg",
  "document_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "bounding_box": { "page": 1, "x": 142, "y": 380, "w": 280, "h": 50 },
  "raw_ocr_transcript": "Item 1: 600x400x400 5-ply ... Rs. 4,250 per 100 pcs",
  "conversion_audit_trail": [
    "Raw input detected: 4,250.00 INR per 100 pcs",
    "Rule applied: UNIT_SCALE (/ 100.0)",
    "Normalized base: 42.500000 INR per box",
    "Ancillary check: No freight or tooling surcharges detected"
  ],
  "is_confirmed_by_buyer": false
}

```

### 3. Copilot Interrogation Endpoint (Two-Layer Split)

* **Endpoint:** `POST /api/copilot/interrogate`
* **Request Body:** `{ "query": "What if we split cheapest per line, but only vendors who passed ISO?" }`
* **Pipeline Execution:**
1. *Layer 1 (LLM Intent Parsing):* Converts text to structured query filters:
```json
{
  "action": "OPTIMIZE_SPLIT_AWARD",
  "constraints": {
    "iso_9001_certified": true,
    "exclude_unverified": true,
    "max_vendor_concentration_pct": 1.0
  }
}

```


2. *Layer 2 (Deterministic Solver):* Executes SQL/Python solver:
* Disqualifies `VEND-03` (ISO certified = False).
* Compares `VEND-01`, `VEND-02`, `VEND-04`, `VEND-05` on `true_landed_unit_cost` for each of the 30 lines.
* Computes absolute sums using 64-bit precision.


3. *Layer 3 (Narrative & UI Payload):* Emits response:
```json
{
  "summary_markdown": "Excluding Vendor 3 (failed ISO 9001), the optimal split allocation reduces spend to ₹3,18,42,000 across 2 vendors.",
  "scenario_metrics": {
    "total_spend_inr": 31842000.00,
    "savings_vs_single_source_inr": 2430000.00,
    "award_distribution": [
      { "vendor_id": "VEND-02", "lines_won": 18, "allocated_spend_inr": 18900000.00 },
      { "vendor_id": "VEND-04", "lines_won": 12, "allocated_spend_inr": 12942000.00 }
    ]
  },
  "highlight_cells": [
    { "line_id": "PKG-001", "winning_vendor_id": "VEND-02" },
    { "line_id": "PKG-002", "winning_vendor_id": "VEND-04" }
  ]
}

```

### 4. RFx Authoring Co-pilot Endpoint
* **Endpoint:** `POST /api/rfx/generate`
* **Request Body:** `{ "prompt": "Draft annual contract for 30 corrugated packaging SKUs with ₹4.0 Cr budget, ISO 9001 gate, Net 60 terms." }`
* **Response:** Structured RFx catalog specification (30 SKUs, category breakdown, questionnaire gates, target volume, and commercial parameters).

### 5. Asymmetric RFx Email Dispatch Endpoint
* **Endpoint:** `POST /api/rfx/dispatch`
* **Request Body:** `{ "rfx_id": "RFX-2026-CORR", "vendor_ids": ["VEND-01", "VEND-02", "VEND-03", "VEND-04", "VEND-05"] }`
* **Response:**
```json
{
  "success": true,
  "dispatched_count": 5,
  "dispatches": [
    { "vendor_id": "VEND-01", "recipient_email": "vendor1@packagingworld.in", "reply_to_email": "rfx-corr-2026-v1@ingest.aerchain.ai" },
    { "vendor_id": "VEND-02", "recipient_email": "vendor2@apexcartons.com", "reply_to_email": "rfx-corr-2026-v2@ingest.aerchain.ai" },
    { "vendor_id": "VEND-03", "recipient_email": "vendor3@nationalpaper.co.in", "reply_to_email": "rfx-corr-2026-v3@ingest.aerchain.ai" },
    { "vendor_id": "VEND-04", "recipient_email": "vendor4@globalpack.com", "reply_to_email": "rfx-corr-2026-v4@ingest.aerchain.ai" },
    { "vendor_id": "VEND-05", "recipient_email": "vendor5@balajitraders.in", "reply_to_email": "rfx-corr-2026-v5@ingest.aerchain.ai" }
  ]
}
```

### 6. Inbound Mailbox & Attachment Webhook
* **Endpoint:** `POST /api/webhooks/email-inbound`
* **Content-Type:** `application/json` OR `multipart/form-data`
* **Payload:** Vendor ID, raw email body text, optional file attachment (`.xlsx`, `.pdf`, `.jpg`, `.png`, `.docx`).
* **Processing:** Computes SHA-256 hash, runs live AI extraction (Gemini / regex fallback) on unstructured rates, executes deterministic normalization ($C \times E$ scoring), and persists atomic transaction to SQLite.

---

## Phase 4: UI Screen Layout & Provenance Interaction

Implement a **Dual-Pane Split Workspace** (React + Tailwind CSS):

```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ Aerchain QuoteEngine | RFx-2026-CORR (Packaging) | Budget: ₹4.00 Cr | Baseline Peg: ₹84/$  │
├───────────────────────────────────────────────────────────────┬────────────────────────────┤
│                    UNIFIED EVALUATION MATRIX                  │    PROCUREMENT COPILOT     │
│ [Filter: All Lines ▼] [Status: 2 Lines Require Review ⚠️]     │                            │
├─────────┬──────────────┬────────┬────────┬────────┬───────────┤ User:                      │
│ Line ID │ Target Vol   │ V1     │ V2 ⚠️  │ V3     │ V4 ($)    │ "Split cheapest per line,  │
├─────────┼──────────────┼────────┼────────┼────────┼───────────┤ only ISO qualified vendors"│
│ PKG-001 │ 100,000 boxes│ ₹45.41 │ ₹42.50 │  ---   │ ₹42.84    │                            │
│         │              │ [Tool] │ [Scan] │ [Miss] │ [Peg 84]  │ Copilot:                   │
├─────────┼──────────────┼────────┼────────┼────────┼───────────┤ Excluded V3 (Failed ISO).  │
│ PKG-002 │ 80,000 boxes │ ₹38.10 │ ₹39.00 │ ₹36.20 │ ₹37.50    │ Optimal split:             │
│         │              │        │        │ [NonQ] │           │ • V2: 18 lines (₹1.89 Cr)  │
├─────────┴──────────────┴────────┴────────┴────────┴───────────┤ • V4: 12 lines (₹1.29 Cr)  │
│                                                               │ Total: ₹3,18,42,000        │
│ [ EVIDENCE DRAWER (SLIDE-OVER ON CELL CLICK) ]                │ [ Apply Scenario to Matrix]│
│ Raw Bounding Box: [ apex_rate_card_scan.jpg (Page 1) ]        │                            │
│ "Rs. 4,250 per 100 pcs" ──> Math: (4250 / 100) = ₹42.50/box   │ [Chat Input: Ask scenario] │
│ Actions: [ Confirm Rate ]  [ Flag Correction ]                │                            │
└───────────────────────────────────────────────────────────────┴────────────────────────────┘

```

### Critical Interactive Behaviors

1. **Click-to-Source Drawer:** Clicking on any cell displaying a warning badge slides open the Evidence Drawer from the right, rendering the exact OCR bounding box overlaid on the raw vendor document alongside the math derivation.
2. **Dynamic UI Highlighting:** When the Copilot returns an award recommendation, the winning vendor cells on the left matrix pulse in green, while losing cells fade to 40% opacity.
3. **Audit Ledger Locking:** When a buyer clicks "Confirm Rate" on a flagged cell, the badge turns from amber (`MANDATORY_BUYER_REVIEW`) to green (`BUYER_CONFIRMED`), recording user ID and timestamp to unlock scenario finalization.

---

## Phase 8: Dynamic Catalog Scoping System

### Guardrails for Custom Scope Operations

When a buyer provides custom line items (e.g., 10 lines instead of 30), the following **strict guardrails** apply:

#### Guardrail 1 — Vendor 3 ISO Compliance Isolation
- Vendor 3's **vendor profile** (`iso_9001_certified = false`, `quality_audit_score = 52%`) is **immutable**. It is never updated by catalog overwrite operations.
- For custom scopes covering Lines 01–10 or Lines 01–20, Vendor 3 will have valid quoted rates (they quoted Lines 01–20 in their original bid).
- In Copilot split-award scenarios with `exclude_failed_questionnaire: true`, Vendor 3 is always disqualified regardless of whether their rates are quoted for the active lines.

#### Guardrail 2 — Vendor 5 Dynamic Normalization
- Vendor 5 (Balaji Traders) quotes at `₹44.00/kg` + 4% freight surcharge.
- For each line item with a new custom `spec_weight_kg`, the normalization formula is **strictly**:

```
normalized_base_inr = spec_weight_kg × 44.00
true_landed_unit_cost = (spec_weight_kg × 44.00) × 1.04
```

This is recalculated per-line atomically during catalog overwrite. The quote table stores the new `unit_conversion_factor = spec_weight_kg` and `freight_surcharge_pct = 0.0400`.

#### Guardrail 3 — Dynamic Budget Aggregation
- `rfx_master.total_target_budget` is recomputed deterministically during every catalog overwrite:

```
total_target_budget = Σ (target_volume_i × baseline_benchmark_price_i)
```

For 10 custom lines (Lines 01–10), the computed budget is **₹3,22,72,500** (₹3.2273 Cr) across **845,000 units**.

#### Guardrail 4 — Copilot Dynamic Scope Alignment
- `deterministicSolver.ts` queries `SELECT * FROM rfx_line_items` dynamically. All line counts (e.g., single-source eligibility checks, markdown headers, ranking tables) reflect the **active catalog size N** rather than a hardcoded 30.
- When 10 custom lines are active, the copilot evaluates split-award across those 10 lines only.

### API Contract: `/api/rfx/line-items` (POST)

| Request Body                                       | Effect                                                         |
| -------------------------------------------------- | -------------------------------------------------------------- |
| `{ "prompt": "Line 01 covers..." }`                | Parse via Gemini + regex fallback, overwrite catalog           |
| `{ "line_items": [ { "id": "PKG-001", ... } ] }`  | Direct structured overwrite with pre-parsed items              |
| `{ "reset": true }`                                | Restore canonical 30-SKU catalog + standard vendor quotes      |

**Response:**

```json
{
  "success": true,
  "count": 10,
  "total_basket_volume": 845000,
  "total_target_budget_inr": 32272500,
  "lines": [...]
}
```

### Catalog Service: `src/lib/catalogService.ts`

- `parseLineItemsRegex(input: string)` — Deterministic regex parser for structured natural language line item blocks.
- `parseLineItemsDualLayer(input: string)` — Gemini AI primary + regex fallback parser.
- `overwriteCatalogWithLineItems(items[])` — Atomic SQLite transaction: clears `vendor_line_quotes` and `rfx_line_items`, inserts new items, re-normalizes all 5 vendors, updates `rfx_master.total_target_budget`, exports CSVs.
- `restoreCanonicalCatalog()` — Restores the standard 30 canonical line items, re-runs full ingestion pipeline (`steps/step_2/ingest.ts`), and exports CSVs.

```
```