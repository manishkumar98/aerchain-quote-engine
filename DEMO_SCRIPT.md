# Aerchain QuoteEngine — Executive Live Demonstration Script

**Demonstration Duration**: 7–10 Minutes  
**Target Audience**: Procurement Leaders, Category Directors, CPOs, Hackathon Evaluators  
**Core Thesis**: *Transforming 3 weeks of chaotic supplier email evaluation into 3 seconds of legally defensible, mathematically provable sourcing decisions.*

---

## Demonstration Flow Overview

| Act | Focus Area | Key Problem Demonstrated | Aerchain Solution | Time |
|---|---|---|---|---|
| **Act 1** | **The Grand Overview** | Manual evaluation across 30 SKUs & 5 suppliers is overwhelming | Real-time 30×5 High-Density Comparison Matrix with ₹4.0 Cr baseline | 1 min |
| **Act 2** | **Heterogeneous Ingestion** | 5 suppliers submit in 5 radically different formats | Normalized unit economics (₹/box) from Excel, Photo OCR, Word, USD PDF, Email | 2 min |
| **Act 3** | **Click-to-Source Provenance** | Internal audit cannot trace where spreadsheet figures originated | Click-to-source Evidence Drawer with SHA-256 hash & pixel bounding boxes | 2 min |
| **Act 4** | **Inbound Email Webhook Simulator** | Supplying portals have low adoption; vendors quote via email | Asymmetric mailbox that ingests raw email text & instantly recalculates the grid | 1.5 min |
| **Act 5** | **Conversational RFx Authoring** | Drafting an RFx takes days of legal and specs drafting | Conversational co-pilot synthesizes 30 SKUs & generates tokenized supplier invites | 1.5 min |
| **Act 6** | **Deterministic Copilot Interrogation** | LLMs hallucinate math; pivot tables take hours | Zero-arithmetic linear solver models split-awards & ISO filters in milliseconds | 2 min |

---

## Act 1: The Grand Overview (1 Minute)

### 🎙️ Presenter Script
> *"Welcome everyone. What you see on screen is the **Aerchain QuoteEngine** dashboard for an annual ₹4.00 Crore enterprise packaging RFx covering 30 canonical SKUs across 5 competing vendors.*
>
> *In traditional procurement, evaluating 30 SKUs across 5 suppliers requires managing 150 separate line quotes. Today, category buyers spend up to 3 weeks wrestling with broken Excel spreadsheets, manually adjusting for freight, and calculating tooling costs.*
>
> *Notice our top enterprise control bar: we have our Master RFx identifier (`RFX-2026-CORR`), the total budget exposure of ₹4.00 Crore, our baseline USD FX peg of ₹84.00, and our live governance tally showing 17 items requiring mandatory review and 126 already auto-verified."*

### 🖱️ Actions on Screen
1. Hover over the **Master RFx badge** in the header.
2. Point out the **Governance Tally Pills**:
   - `17 Mandatory Reviews` (Amber pill)
   - `126 Confirmed / Auto-Verified` (Emerald pill)
3. Scroll down the matrix to show the high-density grid:
   - Sticky SKU specs on the left (dimensions, box weight, target volume).
   - The 5 vendor columns with ISO pass/fail status and modality badges.

---

## Act 2: Multi-Modal Ingestion & Deterministic Normalization (2 Minutes)

### 🎙️ Presenter Script
> *"Notice the column headers for each of our 5 suppliers. Look at the modalities below their names:*
>
> 1. ***Vendor 1 (Packaging World)*** *submitted via structured Excel.*
> 2. ***Vendor 2 (Apex Cartons)*** *submitted a photo of a printed paper rate card taken on a phone at a 20-degree angle.*
> 3. ***Vendor 3 (National Paper)*** *submitted an incomplete Word document that omitted 7 lines and failed our mandatory ISO 9001 compliance gate.*
> 4. ***Vendor 4 (Global Packaging)*** *quoted in US Dollars ($), requiring currency normalization against our ₹84.00 peg.*
> 5. ***Vendor 5 (Balaji Traders)*** *quoted via freeform email text with a complex weight-based formula: ₹44/kg for 5-ply, ₹39/kg for 3-ply, plus 4% freight.*
>
> *Look at line `PKG-001`. Notice that every single vendor's quote has been normalized into an exact, apples-to-apples **True Landed Cost (₹/box)**.*
>
> *Vendor 5's headline rate appeared to be ₹39/kg, which looked cheap. But our engine factored in the 1.05 kg box weight, added the 4% freight surcharge, and determined the landed cost is ₹42.59/box. Meanwhile, Vendor 1 quoted ₹42.00/box, and after amortizing their ₹25,000 tooling fee, their true landed cost is ₹42.02/box—beating Vendor 5!*
>
> *This is True Landed Cost normalization in action—preventing multi-lakh-rupee contracting errors."*

### 🖱️ Actions on Screen
1. Point to **Vendor 2's header**: Modality reads `ANGLED PHOTO`.
2. Point to **Vendor 4's header**: Modality reads `FOREIGN USD PDF`.
3. Point to **Vendor 5's cell for PKG-001**: Show the chips: `FREIGHT` (+4%), `DERIVED_WEIGHT` (1.05 kg).
4. Click the category filter tabs:
   - Click `5-Ply Master (10)`
   - Click `Die-Cut Mailers (7)` — point out that Vendor 3 shows `DISQUALIFIED / OMITTED` for all 7 die-cut items!
   - Click `All Lines` to return to the full matrix.

---

## Act 3: Click-to-Source Provenance & Audit Defense (2 Minutes)

### 🎙️ Presenter Script
> *"Every procurement professional has faced the dreaded audit question: 'Where did this number come from? Show me the paper trail.'*
>
> *Watch what happens when I click any cell in our matrix."*

### 🖱️ Actions on Screen
1. Click on **Vendor 2's cell** for `PKG-001` (or any amber `Review` cell).
2. The **Evidence Drawer** slides out smoothly from the right.

### 🎙️ Presenter Script
> *"The Evidence Drawer provides instant, cryptographically verifiable provenance:*
> * 1. **Document Identity**: We see the exact file name (`vend02_apex_cartons_scan.jpg`) and file modality badge.
> * 2. **Audit Ledger Hash**: Notice the SHA-256 cryptographic hash (`7a9f4c82...`). If the supplier ever disputes the quote, this cryptographic fingerprint proves the source document has not been altered since submission.
> * 3. **Visual Coordinates**: Below is the raw extracted rate (₹41.25) with exact pixel bounding box coordinates `[0.142, 0.520, 0.165, 0.612]`.
> * 4. **Human-in-the-Loop Override**: If the buyer renegotiates this line item over the phone, they don't open Excel. They click 'Adjust Rate', enter the negotiated price with a mandatory audit justification note, and the entire matrix recalculates atomically.
>
> *Let's confirm this rate now."*

### 🖱️ Actions on Screen
3. Click the green **"Confirm Rate"** button at the bottom of the drawer.
4. Notice the button updates to **"Confirmed & Locked"** with a checkmark.
5. Close the drawer.
6. Look at the top navigation bar: **Mandatory Reviews count decreased by 1**, and **Confirmed count increased by 1** in real time!

---

## Act 4: Inbound Mailbox & Attachment Ingestion Simulator (1.5 Minutes)

### 🎙️ Presenter Script
> *"Suppliers hate logging into enterprise procurement portals. In the real world, 80% of quotes are sent via regular email.*
>
> *Aerchain features an **Asymmetric Inbound Mailbox**. Let's open the Inbound Mailbox simulator."*

### 🖱️ Actions on Screen
1. Click the **"Inbound Mailbox"** button in the top header (with the inbox icon).
2. The modal opens showing the 5 multi-modal presets.
3. Click the **"Attach File / Custom Email"** tab.
4. Click the blue link **"Insert Sample Quote Email"**.
   - Notice realistic supplier email text fills the textarea:
     `Dear Procurement Team, Please find our revised commercial submission... 5-ply @ Rs 43.50/kg base, Freight extra at 3.50%...`
5. Click **"Ingest Submission & Update Grid"**.
6. A spinner runs: *"Parsing rates with AI extraction + unit normalization..."*
7. A green feedback banner appears:
   *`Successfully ingested quotation for VEND-05! Normalized all 30 SKUs. Document SHA-256 registered.`*
8. Close the modal. Notice the matrix data refreshed automatically!

---

## Act 5: Conversational RFx Authoring Co-Pilot (1.5 Minutes)

### 🎙️ Presenter Script
> *"What if you are initiating a new RFx from scratch? Drafting packaging specifications usually requires weeks of back-and-forth between engineering and sourcing.*
>
> *Let's click **'New RFx Setup'**."*

### 🖱️ Actions on Screen
1. Click the **"New RFx Setup"** button in the header.
2. In the modal, click one of the quick prompt chips:
   - Click: *"Annual Corrugated Packaging Contract for FMCG Supply Chain (30 SKUs, ₹4.0 Cr budget, ISO 9001 mandatory gate)"*
3. Click the purple button **"Generate Structured RFx"**.
4. The AI synthesizes the packaging specifications:
   - Title: `Corrugated Packaging Annual Contract FY2026-27`
   - Total Target Budget: `₹4,00,00,000` (₹4.00 Cr)
   - 30 Line Items broken into 5-Ply, 3-Ply, Die-Cut, and Protective Packaging.
   - Mandatory ISO 9001 Gate.
5. Scroll down to the **"Asymmetric Tokenized Email Dispatch Routes"** section.

### 🎙️ Presenter Script
> *"Look at these 5 dispatch routes. Instead of forcing vendors to create portal accounts, QuoteEngine generates a unique cryptographic reply-to address for each supplier:*
> * `rfx-corr-2026-v1@ingest.aerchain.ai`
> * `rfx-corr-2026-v2@ingest.aerchain.ai`
>
> *When Vendor 2 replies to their designated address with a photo attachment, our mail router automatically routes the message to the right RFx and vendor profile with zero human sorting."*

6. Click **"Dispatch RFx to 5 Suppliers"**.
7. Green success toast: *"5 tokenized invitations dispatched successfully!"*
8. Close the modal.

---

## Act 6: Procurement Copilot & Zero-Arithmetic Scenarios (2 Minutes)

### 🎙️ Presenter Script
> *"Now for the centerpiece of the platform: the **Procurement Copilot** on the right side of the screen.*
>
> *This is NOT a generic chatbot. Remember: **Zero LLM Arithmetic tokens**. The LLM only parses the buyer's strategic intent into an Abstract Syntax Tree (AST). The actual optimization is executed by a verified, deterministic linear solver in microseconds."*

### 🖱️ Actions on Screen
1. In the Copilot pane, look at the quick prompt chips at the bottom.
2. Click the first benchmark prompt:
   👉 **"Show lowest cost award scenario (ISO-filtered)"**
3. Watch the copilot output:
   - Intent badge: `COMPARE_LANDED_COST`
   - Metric cards appear instantly:
     - **Landed Contract Spend**: `₹3,47,38,300` (₹3.47 Cr)
     - **Savings vs Budget**: `₹52,61,700` (**13.15% below ₹4.0 Cr**)
   - A structured markdown report explains the allocation:
     - Vendor 3 was **disqualified** because they failed the ISO 9001:2015 audit (52% score).
     - Winning lines allocated across Vendor 1, 2, 4, and 5.
4. Click the green button inside the chat bubble:
   👉 **"Apply Scenario to Matrix"**

### 🎙️ Presenter Script
> *"Look at the matrix on the left!*
> * Every winning cell is now highlighted in glowing emerald with an award trophy (🏆 `Award`).*
> * Losing and disqualified cells are dimmed to 35% opacity.*
> * Vendor 3's header displays a red pulsing banner: `DISQUALIFIED (ISO Fail)`.*
> * Notice the top navigation bar now displays an active scenario banner: `Active Scenario: Lowest Cost (ISO Filtered)` with a 1-click `✕ Clear Scenario` button."*

### 🖱️ Actions on Screen
5. Now type a multi-sourcing query in the copilot input:
   Type: **"Split award with max 50% vendor concentration"**
   Press Enter.
6. Copilot executes the split-award optimization:
   - Notice the solver ensures no single vendor receives more than 50% of the basket spend, mitigating single-source disruption risk.
   - Click **"Apply Scenario to Matrix"** to see the dual-award highlights.
7. Click the top nav **"✕ Clear Scenario"** button to instantly restore the matrix to default.

---

## Wrap-Up & Value Proposition (30 Seconds)

### 🎙️ Presenter Script
> *"To summarize what you've just seen:*
> 1. ***From 3 Weeks to 3 Seconds***: Messy Excel, mobile photos, foreign PDFs, and unstructured emails normalized autonomously into True Landed Cost.
> 2. ***100% Legally Defensible***: SHA-256 audit trails, bounding-box provenance, and zero LLM arithmetic hallucinations.
> 3. ***Strategic Agility***: Instant conversational modeling of split awards, ISO filters, and currency shocks.
>
> *Thank you. We'd love to take your questions."*
