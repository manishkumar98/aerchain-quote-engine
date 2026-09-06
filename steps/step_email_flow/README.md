# Step Email Flow: Upstream RFx Authoring & Inbound Asymmetric Email Ingestion

## Overview
This module completes the autonomous procurement lifecycle by connecting upstream conversational RFx authoring, asymmetric multi-vendor email routing, and real-time inbound quote extraction directly into the 30-item by 5-vendor comparison matrix.

---

## Core Architecture & Components

### 1. Conversational RFx Authoring Co-Pilot (`POST /api/rfx/generate`)
- Category buyers provide natural language requirements (e.g. *"Draft an annual rate contract for 30 corrugated packaging SKUs across 3-ply, 5-ply, and die-cut mailers with ₹4.0 Cr budget, ISO 9001 mandatory gate, and Net 60 terms"*).
- Uses Gemini 3.5 Flash-Lite (with deterministic catalog fallback) to produce:
  - Structured RFx parameters (`RFX-2026-CORR`, ₹4.00 Cr budget, 1,458,000 units volume, ₹84.00/$ peg).
  - Mandatory quality gates (ISO 9001:2015 audit requirement).
  - 4 spec categories (5-Ply Master, 3-Ply Universal, Die-Cut Mailer, Protective).

### 2. Asymmetric Email Dispatch & Token Routing (`POST /api/rfx/dispatch`)
- Generates simulated outbound email dispatches to all 5 suppliers.
- Provisions cryptographic tokenized `reply-to` routes:
  - `VEND-01`: `vendor1@packagingworld.in` -> `rfx-corr-2026-v1@ingest.aerchain.ai`
  - `VEND-02`: `vendor2@apexcartons.com` -> `rfx-corr-2026-v2@ingest.aerchain.ai`
  - `VEND-03`: `vendor3@nationalpaper.co.in` -> `rfx-corr-2026-v3@ingest.aerchain.ai`
  - `VEND-04`: `vendor4@globalpack.com` -> `rfx-corr-2026-v4@ingest.aerchain.ai`
  - `VEND-05`: `vendor5@balajitraders.in` -> `rfx-corr-2026-v5@ingest.aerchain.ai`
- Persists dispatch audit trails into SQLite `rfx_dispatches` table.

### 3. Inbound Mailbox & Attachment Webhook (`POST /api/webhooks/email-inbound`)
- Supports both `application/json` (preset batch mode) and `multipart/form-data` (custom files + raw email body).
- **File Provenance**: Calculates SHA-256 cryptographic digest and saves attachments to `public/uploads/` with relative preview paths.
- **AI Extraction Loop**: Extracts rate formulas, freight surcharges, and tooling fees via Gemini with regex fallback (`/(\d+)-ply.*?(\d+(?:\.\d+)?)\s*\/\s*kg/i`).
- **Atomic Persistence**: Normalizes all 30 line items into `vendor_line_quotes` inside an atomic SQLite transaction (`db.transaction`).

### 4. Interactive Frontend Workspace
- **`RfxAuthoringModal.tsx`**: Conversational interface with quick prompts, structured preview, and dispatch trigger.
- **`InboundEmailSimulator.tsx`**: Dual-tab simulator with batch preset processing and custom upload/paste ingestion.
- Dynamic matrix refresh without hard page reload.

---

## Verification

Run the verification test suite:
```bash
npm run test:email-flow
```
