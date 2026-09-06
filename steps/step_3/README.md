# Step 3: Backend API Endpoints & Provenance Contracts

This folder contains integration tests, API route specifications, and verification suites for **Step 3**.

## API Endpoints Implemented

1. **`GET /api/matrix`** ([`src/app/api/matrix/route.ts`](../../src/app/api/matrix/route.ts))
   - Returns the unified 30-line by 5-vendor evaluation grid.
   - Includes:
     - `rfx_id`, `total_budget_inr`, `usd_peg_rate`, `vendors` metadata.
     - `lines`: 30 items with specs, volume, and quotes dictionary for all 5 vendors.
     - Each quote provides: `quote_id`, `is_quoted`, `raw_display`, `landed_cost_inr`, `surcharge_chips` (tooling, freight, FX peg, scaled unit), and `review_status`.
     - Explicit handling for omitted lines (e.g. Vendor 3 lines 21–27) with `is_quoted: false`, `landed_cost_inr: null`, and `review_status: 'EXCLUDED'`.

2. **`GET /api/quotes/:id/provenance`** ([`src/app/api/quotes/[id]/provenance/route.ts`](../../src/app/api/quotes/[id]/provenance/route.ts))
   - Audit metadata and click-to-source evidence for a single quote ID.
   - Includes:
     - Document name and SHA-256 hash.
     - Structured bounding box coordinates `{ page, x, y, w, h }`.
     - Raw OCR text snippet.
     - Zero-hallucination, step-by-step arithmetic conversion audit trail.
     - Certainty sub-metrics ($S_{\text{signal}}, S_{\text{sanity}}, S_{\text{spec}}, C$) and buyer confirmation state.

3. **`POST /api/quotes/:id/confirm`** ([`src/app/api/quotes/[id]/confirm/route.ts`](../../src/app/api/quotes/[id]/confirm/route.ts))
   - Buyer sign-off and rate override route.
   - Supports optional `{ confirmed_rate_inr, override_reason }`.
   - Atomically recalculates `true_landed_unit_cost` factoring in freight % and tooling fees if a rate override is provided.
   - Transitions review status to `BUYER_CONFIRMED` and logs the ISO timestamp.

## Running Integration Tests

```bash
npm run test:step3
# or directly:
npx tsx steps/step_3/test_integration.ts
```
