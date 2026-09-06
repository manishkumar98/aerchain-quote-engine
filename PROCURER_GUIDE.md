# The Procurement Professional's Plain-English Guide to Aerchain QuoteEngine

---

## 1. Executive Summary: Why This Exists

If you work in procurement or strategic sourcing, you know the single most tedious, error-prone phase of any RFx (Request for Proposal / Quotation): **evaluating supplier responses**.

Today, when you issue an RFx for corrugated packaging across 30 SKUs to 5 different suppliers, what comes back is chaos:
* Supplier A sends a clean **Excel sheet** with hidden freight clauses in cell footnotes.
* Supplier B sends an **angled photo of a printed rate card** taken from a mobile phone.
* Supplier C sends a **Word document** that missed 7 line items and failed an ISO audit.
* Supplier D quotes in **US Dollars ($)** per piece, leaving you to guess currency conversion risks.
* Supplier E sends a **freeform email** saying *"We'll charge ₹44/kg for 5-ply, ₹39/kg for 3-ply, plus 4% freight."*

To compare these fairly, category buyers spend **2 to 3 weeks** copying numbers into a master spreadsheet, manually converting kilograms to piece rates, amortizing one-time tooling charges, and adjusting for foreign exchange fluctuations. One misplaced decimal point can cause a multi-million-rupee contracting blunder.

**Aerchain QuoteEngine** solves this entirely. It ingests messy, heterogeneous supplier submissions, converts every single bid into an apples-to-apples **True Landed Cost (₹/box)** using transparent, mathematically provable rules, and provides a conversational procurement copilot to model complex award scenarios in seconds.

---

## 2. How the Platform Works: The 4 Core Stages

```
   ┌────────────────────────────────────────────────────────────────────────┐
   │ 1. INGESTION                                                           │
   │ Accepts Excel, camera photos, PDF, Word, or freeform supplier emails   │
   └───────────────────────────────────┬────────────────────────────────────┘
                                       ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │ 2. DETERMINISTIC NORMALIZATION                                         │
   │ Automatically converts weights, currency, freight %, & tooling charges │
   └───────────────────────────────────┬────────────────────────────────────┘
                                       ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │ 3. GOVERNANCE & PROVENANCE                                             │
   │ Flags discrepancies for human sign-off; links every rate to document   │
   └───────────────────────────────────┬────────────────────────────────────┘
                                       ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │ 4. COPILOT INTERROGATION                                               │
   │ Instant scenario modeling: split-awards, volume limits, ISO filtering  │
   └────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Demystifying "True Landed Cost"

The biggest trap in packaging procurement is comparing **quoted unit rates** instead of **true landed costs**.

### An Example from the Real World
Suppose you need **50,000 units** of SKU `PKG-001` (Heavy Duty Master Shipper, 1.05 kg box weight):

| Factor | Supplier 1 (Packaging World) | Supplier 5 (Balaji Traders) |
|---|---|---|
| **Raw Quote** | Quoted ₹42.00 / box | Quoted ₹39.00 / kg base rate |
| **Apparent Winner?** | Looks more expensive (₹42) | Looks cheaper (₹39) |
| **Weight Conversion** | Already per box | 1.05 kg × ₹39.00 = **₹40.95 / box** |
| **Freight Surcharge** | 0% included | +4.00% extra = **+₹1.64 / box** |
| **Tooling Amortization** | ₹25,000 one-time plate charge (amortized across annual volume = **+₹0.017 / box**) | Nil |
| **True Landed Cost** | **₹42.02 / box** | **₹42.59 / box** |
| **Actual Winner** | 🏆 **Supplier 1 is cheaper by ₹0.57 per box!** | ❌ Lost due to hidden freight surcharge |

Without autonomous normalization, a buyer might mistakenly award the contract to Supplier 5 based on their low ₹39/kg headline rate, wasting hundreds of thousands of rupees over the contract lifecycle.

QuoteEngine computes True Landed Cost using an unbending formula:
$$\text{Landed Cost} = \left(\text{Base Unit Rate} \times (1 + \text{Freight Surcharge})\right) + \text{Amortized Tooling Fee}$$

---

## 4. Why "Zero-LLM Arithmetic" Matters to You

Many modern "AI" tools send your numbers to Large Language Models (like ChatGPT or Claude) and ask them to calculate totals and find the lowest price.

> [!CAUTION]
> **LLMs are text generators, not calculators.** They regularly suffer from hallucinations, rounding errors, and arithmetic drift. In enterprise procurement, an arithmetic error of 0.5% on a ₹4.0 Crore budget is ₹2,00,000 in lost value—and can trigger corporate audit investigations or vendor legal challenges.

Aerchain QuoteEngine uses a **strict two-brain architecture**:
1. **The Language Brain (LLM)**: Only reads text. It parses messy supplier emails and translates your procurement queries into structured instructions (e.g. *"The buyer wants to split awards across vendors with max 50% volume and ISO 9001 pass"*).
2. **The Math Brain (Deterministic Linear Solver)**: Executes all arithmetic in pure, verified code. It guarantees that:
   * Every landed cost is 100% mathematically exact.
   * Every award allocation is provably optimal.
   * Zero hallucinated numbers ever touch your contract sheet.
   * Results are 100% reproducible for internal or external auditors.

---

## 5. The 3 Governance Flags Every Buyer Must Know

In QuoteEngine, every single rate in the comparison matrix is tagged with a clear governance status:

| Badge | Meaning | Action Required by You |
|---|---|---|
| **Auto-Verified** (Score $\ge 90\%$) | Clean data extracted from structured tables with zero ambiguity. | None. Ready for contract allocation. |
| **Mandatory Review** (⚠️ Amber) | Extracted from complex modalities (e.g., angled photo OCR, handwritten notes, or derived weight clauses). | **Required.** Buyer must click the cell, review the highlighted document evidence, and click "Confirm Rate". |
| **Disqualified / Excluded** (⛔ Red) | Supplier omitted the item or failed an enterprise compliance gate (e.g., failed ISO 9001 quality audit). | The system prevents this vendor from receiving line awards in compliant scenarios. |

---

## 6. Click-to-Source Provenance: Your Audit Shield

Have you ever sat in an internal audit meeting where someone asked:
> *"Where did this ₹41.25 figure for Vendor 2 come from? Show me the email."*

With traditional systems, buyers spend hours digging through old inbox threads.

In QuoteEngine:
1. **Click any cell** in the 30-line matrix.
2. The **Evidence Drawer** slides out instantly.
3. You immediately see:
   * The **original document filename** and file modality badge.
   * The **cryptographic SHA-256 hash** of the source file (proving the file has never been tampered with).
   * The exact **visual bounding box** coordinates or extracted email snippet.
   * A 1-click **Rate Override** field to manually adjust the price if commercial negotiations change, with mandatory audit justification logging.

---

## 7. Conversational Scenarios in Plain English

Instead of manually building Excel pivot tables, you can ask the Procurement Copilot questions like:

* *"Show lowest cost award scenario (ISO-filtered)"*
  $\rightarrow$ Disqualifies vendors without ISO 9001:2015, assigns each SKU to the lowest compliant bidder, and displays total spend vs. baseline savings.
* *"Split award with max 50% vendor concentration"*
  $\rightarrow$ Solves a multi-sourcing optimization problem so no single vendor gets more than half your spend, mitigating supply-chain risk.
* *"Single source award to Packaging World"*
  $\rightarrow$ Calculates your total landed spend if you give 100% of the basket to one partner for operational simplicity.
* *"What is our exposure under $1 = ₹88 exchange rate shock?"*
  $\rightarrow$ Re-evaluates foreign bids under simulated currency depreciation.

When you click **"Apply Scenario to Matrix"**, the grid updates with glowing award trophies (🏆) on winning bids and dims unselected bids, with a 1-click reset button in the top navigation bar.

---

## 8. Glossary for Procurement Teams

* **RFx**: Request for Proposal / Quotation.
* **SKU (Stock Keeping Unit)**: A unique corrugated packaging item (e.g., `PKG-001`, `PKG-002`).
* **Canonical Catalog**: The baseline master list of 30 standard packaging items representing ₹4.00 Crore in annual spend.
* **True Landed Cost**: The final cost per unit delivered to your warehouse, factoring in base rate, freight, tooling amortization, and currency exchange.
* **FX Peg**: A fixed benchmark exchange rate (set to ₹84.00/$ in this RFx) used to evaluate international bids on a level playing field.
* **Bounding Box**: Rectangular pixel coordinates $[ymin, xmin, ymax, xmax]$ locating exact rate numbers on a scanned photo or PDF.
* **SHA-256 Hash**: A 64-character digital fingerprint of a supplier's document that guarantees data authenticity.
