# Step 2: Inbound Mock Files & Deterministic Normalization Worker

This folder contains all artifacts, multi-modal mock source files, normalization math engines, and verification suites for **Step 2**.

## Directory Contents

- `mock_data/`:
  - `vendor_1_packaging_world.json`: Multi-tab spreadsheet with 30 items + Cell D34 plate fee (₹25,000).
  - `vendor_2_apex_cartons_ocr.json`: Angled photo OCR stream with `/100 pcs` rates and structured JSON bounding boxes `{ page, x, y, w, h }`.
  - `vendor_3_national_paper_quote.json`: Partial Word doc with 23 items quoted and lines 21–27 strictly omitted (`is_quoted: false`).
  - `vendor_4_global_pack_pdf.json`: Foreign USD PDF quotes with page coordinates.
  - `vendor_5_balaji_email.json`: Freeform email string quoting /kg rates and 4% freight surcharge.
- `normalizationEngine.ts`: Core deterministic calculation worker implementing:
  - **Rule A**: Unit scaling (/100 pcs, /kg by `spec_weight_kg`, and per box).
  - **Rule B**: USD currency conversion at fixed 84.0000 peg.
  - **Rule C**: True Landed Cost with tooling amortization and freight % addition.
  - **Rule D**: Governance matrix ($C \times E$) with peer median calculation (strictly excluding unquoted vendors) and review router.
- `ingest.ts`: Execution pipeline transforming the 5 inbound mock payloads and persisting 150 quotes into `vendor_line_quotes`.
- `verify_step2.ts`: Automated test suite with 31 tests asserting landed cost accuracy, review statuses, and decimal formatting.

## Commands

```bash
# Run multi-modal ingestion & normalization
npx tsx steps/step_2/ingest.ts

# Run Step 2 verification
npx tsx steps/step_2/verify_step2.ts
```
