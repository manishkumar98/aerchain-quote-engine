# PROJECT_CONTEXT: Aerchain QuoteEngine (Autonomous RFx Normalization & Interrogation)

## 1. Executive Objective
Eliminate the multi-day manual quote retyping process by building a system that:
1. Translates natural language RFx requirements into a structured master catalog (30 line items).
2. Ingests raw, unformatted vendor submissions across five modalities (Excel, angled photo, PDF, Word doc, email).
3. Normalizes all responses into a single canonical grid (identical line items, standard per-box units, INR currency, true landed cost).
4. Enables natural language interrogation via deterministic execution (zero math hallucination) to support defensible enterprise award decisions.

---

## 2. Domain & Master Catalog Definition
* **Category**: Corrugated Packaging (Industrial Master Cartons & E-Commerce Mailers)
* **Base Canonical Unit**: `per_box` (Single unit)
* **Standard Operating Currency**: `INR` (Baseline FX peg: 1 USD = 84.00 INR)
* **Total Estimated Spend Exposure**: ₹4,00,00,000 (₹4.0 Crore) across 30 line items

### Master SKUs (30 Line Items)
* **Lines 01–10 (High Volume Core Cartons, 5-Ply B/C Flute)**:
  * Dimensions: 400x300x300mm to 600x400x400mm
  * Volume: 50,000 to 120,000 boxes/item
  * Nominal calculated weight: 0.75 kg to 1.20 kg per box
* **Lines 11–20 (Universal Secondary Shipping Cartons, 3-Ply C-Flute)**:
  * Dimensions: 250x200x150mm to 350x250x200mm
  * Volume: 30,000 to 80,000 boxes/item
  * Nominal calculated weight: 0.35 kg to 0.55 kg per box
* **Lines 21–27 (Die-Cut Self-Locking Mailers, E-Flute)**:
  * Dimensions: 200x150x50mm to 300x200x80mm
  * Volume: 15,000 to 40,000 boxes/item
  * Nominal calculated weight: 0.15 kg to 0.25 kg per box
* **Lines 28–30 (Ancillary Protective Packaging)**:
  * Line 28: Edge Protectors (50x50x1000mm, 10,000 pcs)
  * Line 29: Corrugated Honeycomb Sheets (1200x1000mm, 5,000 pcs)
  * Line 30: Self-Adhesive Reinforced Kraft Tape (72mm x 50m, 8,000 rolls)

---

## 3. Vendor Profiles & Inbound Modalities
* **Vendor 1: Packaging World India (Format: Multi-Tab Excel)**
  * Quoting: 30/30 lines quoted in standard INR per unit.
  * Hidden Caveat: Cell D34 on Tab 2 specifies a non-itemized ₹25,000 one-time stereo cylinder plate charge.
  * Compliance: ISO 9001 = True, FSC Certified = True, Credit Terms = Net 60.
* **Vendor 2: Apex Cartons & Containers (Format: Skewed Smartphone Photo / Scan)**
  * Quoting: Quoted in `₹ per 100 pcs` on printed, tilted letterhead.
  * Normalization: Must divide raw quoted figures by 100.
  * Compliance: ISO 9001 = True, FSC Certified = False, Credit Terms = Net 30.
* **Vendor 3: National Paper & Board Mills (Format: Partial Quote Word/PDF)**
  * Quoting: Partial submission covering only 23 of 30 line items (omits die-cut items 21–27).
  * System Rule: Disqualified from single-source aggregate award; strictly eligible for line-item split awards.
  * Compliance: ISO 9001 = False (Audit score 52%), FSC Certified = False, Credit Terms = Net 45.
* **Vendor 4: Global Pack Holdings (Format: Clean PDF in USD)**
  * Quoting: 30/30 lines quoted in USD.
  * Normalization: Must convert to INR via pegged rate (84.00) and flag for FX sensitivity.
  * Compliance: ISO 9001 = True, FSC Certified = True, Credit Terms = Net 30.
* **Vendor 5: Balaji Traders (Format: Raw Email String)**
  * Quoting: Freeform text body: *"Rates for summer contract: 5-ply @ 44/kg, 3-ply @ 39/kg. Delivery within 4 days. Freight 4% extra on total invoice. Tooling at cost."*
  * Normalization: Must derive unit price using `weight_kg * rate_per_kg` and add 4% freight surcharge to compute landed cost.
  * Compliance: ISO 9001 = True, FSC Certified = False, Credit Terms = Net 15.

---

## 4. Normalization & Math Governance Rules
1. **True Landed Cost Formula**:
   $$\text{Landed Unit Rate} = \left(\text{Base Unit Rate}_{\text{INR}} \times (1 + \text{Freight Surcharge } \%)\right) + \left(\frac{\text{Fixed Ancillary Fee}}{\text{Line Target Volume}}\right)$$
2. **Absolute Decoupling**:
   * LLM generates structured intent/SQL queries only.
   * Zero calculations performed inside generation tokens.
   * All sums, landed costs, and split-award LP optimizations execute in deterministic SQL/Python.
3. **Dual-Axis Review Matrix ($C \times E$)**:
   * Calculate Extraction Certainty ($C \in [0.0, 1.0]$) using OCR quality, median price sanity, and unit matching.
   * Calculate Financial Exposure ($E$) based on line-item spend weight ($\ge 5\%$ is High).
   * Any high-spend line item with $C < 0.90$ routes to `MANDATORY_BUYER_REVIEW`.

---

## 5. Required System Endpoints & UI Panels
* `POST /api/rfx/init`: Seeds master catalog and baseline constraints.
* `POST /api/ingest/vendor`: Processes multi-modal files and runs the normalization engine.
* `GET /api/matrix`: Returns unified comparison data across 30 lines and 5 vendors with provenance metadata.
* `POST /api/copilot/interrogate`: Takes natural language input, generates parameters, runs deterministic solvers, and returns structured tables + cell-highlight instructions.
* **UI Views**:
  * **Left Pane**: Comparison matrix showing Landed Cost, Base Rate, Surcharge Badges, and Review Alerts.
  * **Slide-over Drawer**: Click-to-source provenance highlighting coordinates, raw text, and conversion math.
  * **Right Pane**: Natural language copilot chat interface with table and metric outputs.