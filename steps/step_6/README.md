# Step 6: Dual-Pane UI Integration & Scenario Visualization

## Overview
Step 6 seamlessly wires the Copilot chat interrogation interface into the right pane of the unified procurement workspace, connecting deterministic solver execution directly to dynamic visual feedback in the 30-item by 5-vendor comparison matrix on the left.

---

## Key Features & Operational Nuances Implemented

### 1. Exact Pre-Set Quick-Query Chips
Embedded directly in the Copilot chat pane:
- **`Split cheapest per line, excluding failed quality questionnaire`**: Triggers split-award optimization with zero-trust ISO 9001 compliance enforcement.
- **`Identify hidden ancillary fees across all vendors`**: Unveils buried tooling amortizations, freight surcharges, skew angles, and foreign currency pegs.
- **`Compare landed spend if USD strengthens to 87.00 INR`**: Evaluates currency sensitivity and identifies domestic substitution opportunities.

### 2. Regex Decimal Safety in Intent Parsing
In `src/lib/copilot/intentParser.ts`, group captures for FX queries safely extract full floating-point numbers without truncation:
```typescript
const match = query.match(/(?:moves?|shifts?|goes?|strengthens?|weakens?|appreciates?|depreciates?|at|to)\s+(?:from\s+\d+(?:\.\d+)?\s+to\s+)?(\d{2}(?:\.\d+)?)/i);
if (match && match[1]) {
  exchange_rate_usd_inr = parseFloat(match[1]);
}
```
This guarantees rates like `87.00` are parsed strictly as `87.0` instead of partial strings `87.` or `87.0`.

### 3. Visual Hierarchy: Disqualified Cells vs. Unquoted Cells
To prevent visual collision during ISO-exclusion scenarios:
- **Vendor 3 (VEND-03)** lines 21–27 (which were omitted from the original bid) remain distinctly marked with amber dashed borders as **`Incomplete / Not Quoted · ISO Excluded`**.
- **Vendor 3 (VEND-03)** lines 1–20 & 28–30 (which were quoted) display the prominent rose/red **`Disqualified (ISO Fail)`** badge with strike-through landed cost and red border.
- The **Vendor 3 column header** displays a persistent **`⚠️ DISQUALIFIED (ISO Fail)`** banner during active exclusion scenarios.

### 4. Drawer vs. Scenario State Isolation
The slide-over Evidence Drawer state (`selectedQuoteId`) is completely decoupled from the scenario highlighting state (`activeScenario`, `highlightMap`, `disqualifiedVendorIds`):
- Opening or closing the Evidence Drawer does not tear down or reset active scenario highlighting.
- When a buyer clicks **"Confirm Rate"** or modifies a cell while a scenario is active, the matrix dynamically updates and preserves active scenario overlays without resetting the user's view.

### 5. Clean Scenario Teardown in Top Nav
When a scenario is active:
- A prominent indigo badge in the top navigation bar indicates the active simulation (e.g., `⚡ Active Scenario: Lowest Cost (ISO Filtered)`).
- A one-click **`✕ Clear Scenario`** button immediately clears the active scenario, restoring standard baseline matrix opacity and cell styling without page reloads.

---

## Verification & Test Results

Run the verification test suite:
```bash
npm run test:step6
```

All 29 assertions across 5 test groups pass:
- **Test Group 1**: Exact pre-set query strings & regex decimal safety (`87.00`).
- **Test Group 2**: Disqualified vendor hierarchy (7 unquoted lines preserved, 23 quoted lines tagged disqualified).
- **Test Group 3**: Dynamic matrix highlighting contract (all 30 line items awarded, 0 to VEND-03).
- **Test Group 4**: FX sensitivity substitution analysis (13 lines flipped to domestic suppliers).
- **Test Group 5**: Full API route interrogation contract (`POST /api/copilot/interrogate`).
