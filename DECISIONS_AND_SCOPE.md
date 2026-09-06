# Aerchain QuoteEngine — Architectural Scope & Decisions Note

**System**: Autonomous RFx Quote Normalization & Interrogation Engine  
**Domain**: Enterprise Corrugated Packaging Procurement (30 SKUs, ₹4.0 Cr Spend)  
**Author**: Engineering & Sourcing Architecture Team  

---

## 1. What We Built

We designed and implemented a production-grade, full-stack enterprise sourcing application composed of five tightly integrated subsystems:

### A. Canonical Packaging Schema & ACID Data Foundation
* **SQLite with WAL Mode & Foreign Key Enforcement**: Created a relational data schema (`rfx_master`, `rfx_line_items`, `vendors`, `vendor_line_quotes`, `vendor_ancillary_charges`, `rfx_dispatches`).
* **Canonical Catalog (30 SKUs, ₹4.0 Cr)**: Engineered a realistic, high-exposure packaging basket spanning 10 5-Ply Master Shippers, 10 3-Ply Universal Cartons, 7 Die-Cut Self-Locking Mailers, and 3 Protective SKUs with verified dimensions, box weights ($0.15\text{ kg} - 1.20\text{ kg}$), target volumes ($1.458\text{M units}$), and baseline benchmarks.

### B. Heterogeneous Multi-Modal Ingestion Pipeline
* **5 Distinct Supplier Modalities**:
  1. `VEND-01` (Packaging World): Structured Excel with amortized tooling plate fees.
  2. `VEND-02` (Apex Cartons): 20-degree angled camera photo OCR with bounding box coordinates.
  3. `VEND-03` (National Paper): Incomplete Word document omitting 7 die-cut lines with a failed ISO 9001:2015 audit score ($52\%$).
  4. `VEND-04` (Global Packaging): Foreign export quote in USD requiring fixed baseline currency peg normalization ($\text{₹}84.00/\$$).
  5. `VEND-05` (Balaji Traders): Freeform email stream with weight-based clauses ($\text{₹}44/\text{kg}$, $\text{₹}39/\text{kg}$) and $+4.0\%$ freight surcharges.

### C. Deterministic Normalization Engine
* **True Landed Cost Formula**:
  $$\text{Landed Cost} = \left(\text{Base Unit Rate} \times (1 + \text{Freight Surcharge})\right) + \text{Amortized Tooling Fee}$$
* Automated conversion from weight-derived pricing ($\text{box weight} \times \text{₹}/\text{kg}$) into exact per-piece costs, eliminating hidden vendor pricing traps.

### D. High-Density Comparison Matrix & Provenance Drawer
* **Dual-Pane Next.js Interface**: 30-line sticky grid supporting real-time category filtering, search, and dynamic responsive split pane.
* **Click-to-Source Evidence Drawer**: Every cell exposes document filename, modality badge, SHA-256 cryptographic audit ledger hash, visual bounding box coordinates, and a human-in-the-loop rate override mechanism with mandatory buyer audit logging.

### E. Procurement Copilot with Zero-LLM Arithmetic
* **Two-Brain Architecture**: Google Gemini LLM parses natural language buyer queries into an Abstract Syntax Tree (AST) representing intent and constraints. If the LLM is offline, a deterministic heuristic parser provides instant fallback with zero downtime.
* **Deterministic Linear Programming Solver**: Executes award evaluations, single-source totals, split-award constraints (e.g. max 50% vendor concentration), and compliance filters (ISO 9001) in pure code with 0 arithmetic hallucination tokens.

### F. Asymmetric Tokenized Email Inbound Router
* Unique cryptographic reply-to routes per supplier (`rfx-corr-2026-v{id}@ingest.aerchain.ai`) that eliminate supplier portal friction while preserving automated ingestion into SQLite.

---

## 2. What We Deliberately Left Out (and Why)

| What We Left Out | Technical & Commercial Rationale |
|---|---|
| **LLM-Based Arithmetic & Scoring** | **Zero tolerance for financial hallucination.** LLMs cannot guarantee exact mathematical totals, rounding consistency, or defensible audit proofs. We strictly confined the LLM to language comprehension; all math is deterministic TypeScript. |
| **Microservice / Kubernetes Sprawl** | **Unnecessary latency and operational failure modes.** A single embedded SQLite engine in WAL mode provides microsecond query latency, ACID transactions, and zero infrastructure overhead compared to distributed multi-database setups. |
| **Black-Box "1-Click Auto-Awarding"** | **Procurement legal liability.** Enterprise procurement requires legal defensibility. We deliberately built mandatory human-in-the-loop review gates (⚠️ amber pills) for low-confidence or extracted bids rather than blindly finalizing contracts without buyer oversight. |
| **Heavyweight Supplier Portal Portals** | **Supplier adoption failure.** Suppliers routinely refuse to register for third-party buyer portals for one-off RFxs. We replaced portal logins with asymmetric email routing tokens (`rfx-corr-2026-v1@ingest.aerchain.ai`), meeting suppliers where they already work (email/attachments). |
| **Generic ERP Connectors (SAP / Ariba)** | **Narrow focus on the core unaddressed problem.** Enterprise ERPs already handle PO creation and invoice clearing; what they cannot do is extract, normalize, and interrogate unstructured, multi-modal quote documents. We focused 100% of engineering bandwidth on the normalization and interrogation engine. |

---

## 3. Key Architectural Decisions

1. **Hybrid Deterministic Architecture**:
   * *Layer 1 (Semantic)*: LLM extracts intent $\rightarrow$ produces validated JSON AST.
   * *Layer 2 (Mathematical)*: Branch-and-bound optimization solver evaluates constraint satisfaction $\rightarrow$ produces $100\%$ reproducible financial ledger outputs.
2. **Cryptographic SHA-256 Ledger**:
   * Every incoming file is hashed upon receipt. The hash is immutably stored alongside quotes, preventing post-facto vendor quote tampering disputes.
3. **Aerchain Aera AI Visual Language**:
   * Re-skinned the entire UI to match `aerchain.io/aera-ai` using the official deep violet brand gradient (`#3D05C6` $\rightarrow$ `#9937FB`), **Mina** typography, and high-contrast dark card surfaces.
