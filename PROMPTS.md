### 2. Prompts to Build the Product in Antigravity

Copy and run these prompts sequentially inside Antigravity:

#### Prompt 1: Project Scaffolding & Normalized Data Engine

> "Initialize a Next.js (App Router), Tailwind CSS, and SQLite/PostgreSQL full-stack project for an enterprise procurement evaluation tool called 'Aerchain QuoteEngine'. Build a seed script containing 30 corrugated packaging line items (SKUs: PKG-001 to PKG-030, covering 3-ply universal cartons, 5-ply master cartons, and die-cut mailers with specified target volumes). Implement the database schema for `rfx_line_items`, `vendors`, `vendor_quotes`, and `vendor_commercials`. Implement a deterministic normalization utility in TypeScript/Python that accepts raw inputs and converts foreign currencies (USD at fixed 84.00 INR), units ('per 100 pcs' divided by 100, 'per kg' multiplied by SKU spec weight), and calculates True Landed Cost by factoring in freight percentages and amortized plate/tooling fees over line volumes."

#### Prompt 2: 5-Vendor Ingestion Pipeline & Verification Engine

> "Implement an ingestion pipeline that parses vendor quotes from 5 simulated inbound submissions: (1) Clean Excel with 30 items and a hidden ₹25,000 plate fee in cell D34; (2) An angled smartphone photo of a printed rate card quoting in '₹ per 100 pcs'; (3) A partial quote file containing only 23 of 30 lines; (4) A foreign quote in USD with Net 30 payment terms; (5) A freeform email string with rates at ₹44/kg and ₹39/kg with '+4% freight extra'. Compute a composite Extraction Certainty score (C) and Financial Exposure (E) for every price. Output states: `AUTO_VERIFIED`, `FLAG_REVIEW_RECOMMENDED`, and `MANDATORY_BUYER_REVIEW`. Build an API endpoint `/api/quotes/matrix` returning all 30 lines side-by-side across all 5 vendors with their raw and landed prices."

#### Prompt 3: Unified Comparison Grid with Click-to-Source Provenance Drawer

> "Build the main buyer comparison UI. Create a side-by-side grid showing 30 rows (packaging SKUs) and 5 vendor columns. Each cell must render: (1) True Landed Unit Cost (bold), (2) Quoted Raw Price (muted), and (3) Warning chips for surcharges or ambiguous units. Missing quotes must render an explicit amber 'Incomplete / Not Quoted' state. When a user clicks any price cell, open a slide-over 'Evidence Drawer' that renders the source document snippet, file hash, exact coordinate bounding box, raw string, and the mathematical formula used for unit conversion. Include a one-click 'Approve / Override' button for buyer sign-off."

#### Prompt 4: Deterministic NL Interrogation Copilot

> "Build a split-pane interface with the grid on the left and an AI Copilot chat pane on the right. Connect the chat endpoint to an LLM system that translates buyer natural language queries strictly into parameterized SQL operations or deterministic Python solvers—do not compute mathematical sums inside LLM text generation. Enable the copilot to answer: (1) 'What is the cheapest split-award per line excluding vendors failing ISO quality?'; (2) 'Identify all buried footnote fees across suppliers'; and (3) 'Compare total landed spend if USD moves from 84 to 87 INR'. Render answers with structured markdown tables, metrics cards, and trigger dynamic cell-highlighting on the main comparison table for awarded items."

---

#### Prompt 5: Inbound Email Simulator with manual file attachment and paste capabilities**.

---

### Updated Antigravity Implementation Prompt

```text
Build the upstream conversational RFx authoring and asymmetric email ingestion workflow for the Aerchain QuoteEngine, including support for custom user file attachments and inbound email simulation. Connect this seamlessly into the existing 30-line comparison matrix and copilot workspace.

Adhere strictly to the assignment principle: "Stub the plumbing, but the AI loops must be real. Fake the SMTP server if you like. Don't fake the extraction, don't fake the reasoning."

---

### 1. Core Workflow to Implement

1. RFx Authoring Co-pilot:
   - The category buyer describes sourcing requirements in natural language (e.g., "Draft an annual rate contract for 30 corrugated packaging SKUs across 3-ply, 5-ply, and die-cut mailers with ₹4.0 Cr budget, ISO 9001 mandatory gate, and Net 60 terms").
   - The co-pilot generates the structured RFx specification: catalog breakdown (30 SKUs), questionnaire criteria, and baseline commercial terms.

2. Asymmetric Email Dispatch:
   - A "Dispatch RFx" modal surfaces the generated package and displays 5 vendor recipient email chips with tokenized reply-to routes:
     • Vendor 1: vendor1@packagingworld.in (Reply-To: rfx-corr-2026-v1@ingest.aerchain.ai)
     • Vendor 2: vendor2@apexcartons.com (Reply-To: rfx-corr-2026-v2@ingest.aerchain.ai)
     • Vendor 3: vendor3@nationalpaper.co.in (Reply-To: rfx-corr-2026-v3@ingest.aerchain.ai)
     • Vendor 4: vendor4@globalpack.com (Reply-To: rfx-corr-2026-v4@ingest.aerchain.ai)
     • Vendor 5: vendor5@balajitraders.in (Reply-To: rfx-corr-2026-v5@ingest.aerchain.ai)
   - Clicking "Dispatch via Email" simulates outbound transmission and logs dispatch timestamps.

3. Inbound Mailbox & Attachment Ingestion Simulator:
   - Implement an inbound webhook endpoint `POST /api/webhooks/email-inbound` supporting both standard JSON (for preset simulation) and `multipart/form-data` (for custom user file uploads).
   - In the top navigation of the main workspace, provide an "Inbound Mailbox" button and modal featuring:
     a. "Batch Ingest All 5 Presets": Processes the 5 heterogeneous submissions in sequence:
        - VEND-01: Multi-tab Excel (hidden ₹25k plate charge in cell D34)
        - VEND-02: Angled photo scan of printed rate card (/100 pcs)
        - VEND-03: Partial bid doc (omitting lines 21–27) + failed ISO audit score (52%)
        - VEND-04: Foreign export PDF quoted in USD ($0.12–$0.58)
        - VEND-05: Freeform email body string ("5-ply @ 44/kg, 3-ply @ 39/kg, freight 4% extra")
     b. "Attach Custom Submission": Allows the user or evaluator to pick a target vendor and either:
        - Upload an arbitrary file attachment (.xlsx, .pdf, .jpg, .png, .docx)
        - Paste custom email text
     c. Live Ingestion Feedback: Shows real-time progress, computes the SHA-256 file hash, runs `lib/normalizationEngine.ts`, persists quotes to SQLite, and updates the 30-line comparison matrix dynamically without a hard page reload.

---

### 2. Backend Routes & Storage

1. `src/app/api/rfx/generate/route.ts` (POST):
   - Accepts: `{ prompt: string }`
   - Returns structured JSON defining RFX-2026-CORR (30 lines across 4 packaging categories, questionnaire gates, ₹4.0 Cr budget).

2. `src/app/api/rfx/dispatch/route.ts` (POST):
   - Accepts: `{ rfx_id: string, vendor_ids: string[] }`
   - Generates simulated message tokens and returns `{ success: true, dispatched_count: 5 }`.

3. `src/app/api/webhooks/email-inbound/route.ts` (POST):
   - Accepts `multipart/form-data` (fields: `vendor_id`, `raw_text`, optional file `attachment`) OR JSON payload.
   - If a file is uploaded, reads the buffer, computes its SHA-256 hash, and saves it to `public/uploads/` for visual provenance rendering.
   - Runs normalization worker on line items (handling unit scales, USD currency peg, freight %, and tooling amortization).
   - Computes composite certainty ($C$) and financial exposure ($E$) and writes to `vendor_line_quotes` and `vendor_ancillary_charges`.

---

### 3. Frontend UI Integration

1. `src/components/rfx/RfxAuthoringModal.tsx`:
   - Modal accessible via "New RFx Setup" button in the top navigation bar.
   - Includes prompt chip: *"Draft annual contract for 30 corrugated packaging SKUs with ₹4.0 Cr budget, ISO 9001 gate, Net 60 terms."*
   - Displays structured preview and one-click "Dispatch to Suppliers" button.

2. `src/components/rfx/InboundEmailSimulator.tsx`:
   - Mounted in the header of `src/app/page.tsx` next to the filter buttons.
   - Modal provides the preset list of 5 inbound vendor messages, the "Ingest All 5" action, and the "Attach File / Paste Email" upload form.
   - Triggers `onIngestionComplete` to refresh the comparison matrix and Evidence Drawer seamlessly.

---

### 4. Automated Verification Script

Create `steps/step_email_flow/test_email_flow.ts`:
- Validates the RFx generation endpoint response schema.
- Simulates dispatch to the 5 vendors.
- Executes `POST /api/webhooks/email-inbound` across all 5 vendor payloads.
- Asserts that all 150 quotes are correctly persisted in SQLite with valid landed costs and flags.
- Ensures zero regressions across existing matrix and copilot interrogation tests (`npm run test:step5 && npm run test:step6`).

```