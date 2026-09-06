PRAGMA foreign_keys = ON;

-- 1. Master RFx Catalog (Single Source of Truth)
CREATE TABLE IF NOT EXISTS rfx_master (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Corrugated Packaging',
    baseline_currency TEXT NOT NULL DEFAULT 'INR',
    usd_peg_rate TEXT NOT NULL DEFAULT '84.0000',
    total_target_budget TEXT NOT NULL DEFAULT '40000000.00',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 30 Canonical Line Items
CREATE TABLE IF NOT EXISTS rfx_line_items (
    id TEXT PRIMARY KEY,                      -- e.g., 'PKG-001'
    rfx_id TEXT NOT NULL REFERENCES rfx_master(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,             -- 1 to 30
    sku_name TEXT NOT NULL,
    spec_category TEXT NOT NULL,              -- '5-Ply Master', '3-Ply Universal', 'Die-Cut Mailer', 'Protective'
    dimensions TEXT NOT NULL,                 -- e.g., '600x400x400mm'
    spec_weight_kg TEXT NOT NULL,             -- Nominal box weight stored as TEXT for arbitrary precision
    target_volume INTEGER NOT NULL,           -- Required production quantity
    baseline_benchmark_price TEXT NOT NULL    -- Stored as TEXT for arbitrary precision (e.g. '45.0000')
);

-- 3. Supplier Profiles & Compliance Data
CREATE TABLE IF NOT EXISTS vendors (
    id TEXT PRIMARY KEY,                      -- 'VEND-01' to 'VEND-05'
    name TEXT NOT NULL,
    inbound_modality TEXT NOT NULL,           -- 'MULTI_TAB_EXCEL', 'ANGLED_PHOTO', 'PARTIAL_WORD', 'FOREIGN_USD_PDF', 'RAW_EMAIL'
    raw_document_url TEXT NOT NULL,
    doc_sha256 TEXT NOT NULL,
    iso_9001_certified INTEGER NOT NULL DEFAULT 0, -- 1 for True, 0 for False
    fsc_certified INTEGER NOT NULL DEFAULT 0,      -- 1 for True, 0 for False
    credit_terms TEXT NOT NULL,                    -- 'Net 60', 'Net 30', 'Net 45', 'Net 15'
    quality_audit_score TEXT NOT NULL              -- Stored as TEXT e.g. '95.00'
);

-- 4. Extracted & Normalized Line-Item Quotes
CREATE TABLE IF NOT EXISTS vendor_line_quotes (
    id TEXT PRIMARY KEY,
    rfx_line_item_id TEXT NOT NULL REFERENCES rfx_line_items(id) ON DELETE CASCADE,
    vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    is_quoted INTEGER NOT NULL DEFAULT 1,          -- 1 for True, 0 for False
    
    -- Raw Ingestion Layer (Immutable)
    raw_price_string TEXT,                         -- e.g., "₹4,200 / 100 pcs"
    raw_numeric_value TEXT,                        -- e.g., "4200.00"
    raw_unit TEXT,                                 -- 'per 100 pcs', 'kg', 'box', 'USD'
    raw_currency TEXT DEFAULT 'INR',
    
    -- Normalization Layer
    canonical_unit TEXT DEFAULT 'per_box',
    unit_conversion_factor TEXT NOT NULL DEFAULT '1.000000',
    normalized_base_price_inr TEXT,                -- Converted to single unit INR
    
    -- True Landed Cost Layer
    freight_surcharge_pct TEXT DEFAULT '0.0000',   -- e.g., '0.0400' for 4%
    amortized_tooling_inr TEXT DEFAULT '0.0000',   -- Fixed Tooling / Target Volume
    payment_term_penalty_inr TEXT DEFAULT '0.0000',
    true_landed_unit_cost TEXT,                    -- Final figure for rankings
    
    -- Confidence & Governance Matrix
    signal_confidence TEXT NOT NULL,               -- S_signal (0.000 to 1.000)
    spec_confidence TEXT NOT NULL,                 -- S_spec (0.000 to 1.000)
    sanity_confidence TEXT NOT NULL,               -- S_sanity (0.000 to 1.000)
    composite_certainty TEXT NOT NULL,             -- Composite certainty C
    financial_exposure TEXT NOT NULL,              -- 'HIGH', 'MEDIUM', 'LOW'
    review_status TEXT NOT NULL DEFAULT 'AUTO_VERIFIED', -- 'AUTO_VERIFIED', 'FLAG_REVIEW_RECOMMENDED', 'MANDATORY_BUYER_REVIEW', 'BUYER_CONFIRMED'
    
    -- Bounding-Box & Source Provenance
    source_page_number INTEGER DEFAULT 1,
    source_bounding_box TEXT,                      -- JSON string e.g. '{"x": 120, "y": 340, "w": 210, "h": 45}'
    source_snippet_text TEXT,
    human_override_reason TEXT,
    reviewed_at TIMESTAMP
);

-- 5. Off-Sheet Vendor Ancillary Fees
CREATE TABLE IF NOT EXISTS vendor_ancillary_charges (
    id TEXT PRIMARY KEY,
    vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    fee_type TEXT NOT NULL,                        -- 'TOOLING_PLATE_FEE', 'FREIGHT_SURCHARGE', 'MINIMUM_ORDER_PENALTY'
    fee_scope TEXT NOT NULL,                       -- 'BASKET_FIXED', 'PERCENTAGE_ON_TOTAL', 'PER_LINE'
    raw_quoted_text TEXT NOT NULL,
    amount_inr TEXT DEFAULT '0.00',
    percentage_value TEXT DEFAULT '0.0000',
    source_location_ref TEXT                       -- e.g., 'Cell D34 on Tab "Terms"'
);

-- 6. Asymmetric RFx Email Dispatches
CREATE TABLE IF NOT EXISTS rfx_dispatches (
    id TEXT PRIMARY KEY,
    rfx_id TEXT NOT NULL REFERENCES rfx_master(id) ON DELETE CASCADE,
    vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    reply_to_email TEXT NOT NULL,
    dispatch_token TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DELIVERED',
    dispatched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for rapid interrogation & relational joins
CREATE INDEX IF NOT EXISTS idx_rfx_line_items_rfx ON rfx_line_items(rfx_id);
CREATE INDEX IF NOT EXISTS idx_vendor_line_quotes_item_vendor ON vendor_line_quotes(rfx_line_item_id, vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_ancillary_vendor ON vendor_ancillary_charges(vendor_id);
CREATE INDEX IF NOT EXISTS idx_rfx_dispatches_rfx_vendor ON rfx_dispatches(rfx_id, vendor_id);

