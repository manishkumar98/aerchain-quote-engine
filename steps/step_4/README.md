# Step 4: Comparison Matrix UI & Click-to-Source Evidence Drawer

This folder contains documentation and test utilities for the frontend comparison workspace built in **Step 4**.

## Key Components Implemented

1. **`ComparisonMatrix.tsx`** ([`src/components/matrix/ComparisonMatrix.tsx`](../../src/components/matrix/ComparisonMatrix.tsx))
   - High-density table rendering all 30 packaging SKUs as rows and 5 vendors as columns.
   - **Sticky Coordinates**:
     - Column 1 (`Line Item Specs`) and Column 2 (`Volume & Target Benchmark`) frozen horizontally on scroll.
     - Header row with vendor compliance badges frozen vertically on downward scroll.
     - Top-left intersection frozen with high z-index (`z-40`).
   - Quick-filter tabs: `All Lines`, `5-Ply Master`, `3-Ply Universal`, `Die-Cut Mailers`, `Protective`, `Needs Review (⚠️)`.
   - Real-time search bar filtering across SKU IDs, category names, and specifications.

2. **`MatrixCell.tsx`** ([`src/components/matrix/MatrixCell.tsx`](../../src/components/matrix/MatrixCell.tsx))
   - Bold True Landed Unit Cost in INR.
   - Muted raw price display (`$0.51/box`, `₹4,250 / 100 pcs`, `₹44/kg`).
   - Color-coded chips for surcharges (`+4% Freight`, `Amortized Tooling`, `Peg @ 84`, `Scaled /100`).
   - Alert badges: Amber pulse for `MANDATORY_BUYER_REVIEW`, green for `BUYER_CONFIRMED`.
   - Explicit `Incomplete / Not Quoted` placeholder for omitted lines (Vendor 3 lines 21–27).

3. **`EvidenceDrawer.tsx`** ([`src/components/matrix/EvidenceDrawer.tsx`](../../src/components/matrix/EvidenceDrawer.tsx))
   - Slide-over panel anchored to the right with smooth animation and backdrop blur.
   - **Visual Bounding Box**: Responsive percentage coordinate mapping with auto-scroll centering.
   - **Zero-Hallucination Arithmetic Trail**: Clear timeline cards showing each normalization step.
   - **Governance Gauges**: Visual meters for $S_{\text{signal}}, S_{\text{sanity}}, S_{\text{spec}}$, Composite Certainty $C$, and Financial Exposure $E$.
   - **Audit Provenance**: Document filename, SHA-256 hash copy button, and OCR snippet.
   - **Buyer Sign-off & Override**: "Confirm Rate" button with optional rate adjustment field and "Next Flagged Line" fast triage navigation.

4. **`WorkspacePage`** ([`src/app/page.tsx`](../../src/app/page.tsx))
   - Header control bar showing RFx metadata, budget exposure, and live counter chips (`17 Mandatory Reviews`, `Confirmed`, `Auto-Verified`).
   - Optimistic state updates on rate confirmation with background API synchronization.

## Verification & Testing

- Production build verification: `npm run build`
- API contract verification: `npm run test:step3`
- Browser interactive testing with `browser_subagent` verifying grid rendering, cell interaction, and drawer confirmation.
