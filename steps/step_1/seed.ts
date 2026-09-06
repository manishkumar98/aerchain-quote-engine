import { getDatabase, closeDatabase } from '../../src/lib/db';

export interface CanonicalLineItem {
  id: string;
  rfx_id: string;
  line_number: number;
  sku_name: string;
  spec_category: '5-Ply Master' | '3-Ply Universal' | 'Die-Cut Mailer' | 'Protective';
  dimensions: string;
  spec_weight_kg: string;
  target_volume: number;
  baseline_benchmark_price: string;
}

export interface VendorProfile {
  id: string;
  name: string;
  inbound_modality: 'MULTI_TAB_EXCEL' | 'ANGLED_PHOTO' | 'PARTIAL_WORD' | 'FOREIGN_USD_PDF' | 'RAW_EMAIL';
  raw_document_url: string;
  doc_sha256: string;
  iso_9001_certified: number;
  fsc_certified: number;
  credit_terms: string;
  quality_audit_score: string;
}

export interface AncillaryCharge {
  id: string;
  vendor_id: string;
  fee_type: 'TOOLING_PLATE_FEE' | 'FREIGHT_SURCHARGE' | 'MINIMUM_ORDER_PENALTY';
  fee_scope: 'BASKET_FIXED' | 'PERCENTAGE_ON_TOTAL' | 'PER_LINE';
  raw_quoted_text: string;
  amount_inr: string;
  percentage_value: string;
  source_location_ref: string;
}

// 1. Master RFx Definition
export const MASTER_RFX = {
  id: 'RFX-2026-CORR',
  title: 'Corrugated Packaging Annual Contract FY2026-27',
  category: 'Corrugated Packaging',
  baseline_currency: 'INR',
  usd_peg_rate: '84.0000',
  total_target_budget: '40000000.00', // ₹4.0 Crore
};

// 2. Exactly 30 Canonical Packaging Items
// Math verified: sum(target_volume * baseline_benchmark_price) === 40,000,000.00 INR
export const CANONICAL_LINE_ITEMS: CanonicalLineItem[] = [
  // --- Lines 01–10: 5-Ply Master Shippers (B/C Flute, 0.75 - 1.20 kg, High/Med exposure) ---
  {
    id: 'PKG-001',
    rfx_id: 'RFX-2026-CORR',
    line_number: 1,
    sku_name: '5-Ply Heavy Master Shipper (600x400x400mm)',
    spec_category: '5-Ply Master',
    dimensions: '600x400x400mm',
    spec_weight_kg: '1.1500',
    target_volume: 100000,
    baseline_benchmark_price: '45.0000', // Spend: 4,500,000 (11.25% - High)
  },
  {
    id: 'PKG-002',
    rfx_id: 'RFX-2026-CORR',
    line_number: 2,
    sku_name: '5-Ply Standard Heavy Shipper (550x350x350mm)',
    spec_category: '5-Ply Master',
    dimensions: '550x350x350mm',
    spec_weight_kg: '1.0500',
    target_volume: 80000,
    baseline_benchmark_price: '38.0000', // Spend: 3,040,000 (7.60% - High)
  },
  {
    id: 'PKG-003',
    rfx_id: 'RFX-2026-CORR',
    line_number: 3,
    sku_name: '5-Ply Bulk Cargo Shipper (500x350x300mm)',
    spec_category: '5-Ply Master',
    dimensions: '500x350x300mm',
    spec_weight_kg: '0.9800',
    target_volume: 90000,
    baseline_benchmark_price: '36.0000', // Spend: 3,240,000 (8.10% - High)
  },
  {
    id: 'PKG-004',
    rfx_id: 'RFX-2026-CORR',
    line_number: 4,
    sku_name: '5-Ply Reinforced Export Carton (500x400x350mm)',
    spec_category: '5-Ply Master',
    dimensions: '500x400x350mm',
    spec_weight_kg: '1.1000',
    target_volume: 70000,
    baseline_benchmark_price: '42.0000', // Spend: 2,940,000 (7.35% - High)
  },
  {
    id: 'PKG-005',
    rfx_id: 'RFX-2026-CORR',
    line_number: 5,
    sku_name: '5-Ply Industrial Component Shipper (520x380x320mm)',
    spec_category: '5-Ply Master',
    dimensions: '520x380x320mm',
    spec_weight_kg: '1.0200',
    target_volume: 65000,
    baseline_benchmark_price: '40.0000', // Spend: 2,600,000 (6.50% - High)
  },
  {
    id: 'PKG-006',
    rfx_id: 'RFX-2026-CORR',
    line_number: 6,
    sku_name: '5-Ply Heavy Duty Warehouse Box (480x320x300mm)',
    spec_category: '5-Ply Master',
    dimensions: '480x320x300mm',
    spec_weight_kg: '0.9000',
    target_volume: 75000,
    baseline_benchmark_price: '34.0000', // Spend: 2,550,000 (6.38% - High)
  },
  {
    id: 'PKG-007',
    rfx_id: 'RFX-2026-CORR',
    line_number: 7,
    sku_name: '5-Ply Medium Freight Carton (450x300x300mm)',
    spec_category: '5-Ply Master',
    dimensions: '450x300x300mm',
    spec_weight_kg: '0.8500',
    target_volume: 60000,
    baseline_benchmark_price: '32.0000', // Spend: 1,920,000 (4.80% - Medium)
  },
  {
    id: 'PKG-008',
    rfx_id: 'RFX-2026-CORR',
    line_number: 8,
    sku_name: '5-Ply Compact Heavy Shipper (420x300x280mm)',
    spec_category: '5-Ply Master',
    dimensions: '420x300x280mm',
    spec_weight_kg: '0.8000',
    target_volume: 55000,
    baseline_benchmark_price: '30.0000', // Spend: 1,650,000 (4.13% - Medium)
  },
  {
    id: 'PKG-009',
    rfx_id: 'RFX-2026-CORR',
    line_number: 9,
    sku_name: '5-Ply Jumbo Master Shipper (600x450x400mm)',
    spec_category: '5-Ply Master',
    dimensions: '600x450x400mm',
    spec_weight_kg: '1.2000',
    target_volume: 50000,
    baseline_benchmark_price: '48.0000', // Spend: 2,400,000 (6.00% - High)
  },
  {
    id: 'PKG-010',
    rfx_id: 'RFX-2026-CORR',
    line_number: 10,
    sku_name: '5-Ply Base Modular Carton (400x300x300mm)',
    spec_category: '5-Ply Master',
    dimensions: '400x300x300mm',
    spec_weight_kg: '0.7500',
    target_volume: 50000,
    baseline_benchmark_price: '28.0000', // Spend: 1,400,000 (3.50% - Medium)
  },

  // --- Lines 11–20: 3-Ply Universal Cartons (C-Flute, 0.35 - 0.55 kg, Med/Low exposure) ---
  {
    id: 'PKG-011',
    rfx_id: 'RFX-2026-CORR',
    line_number: 11,
    sku_name: '3-Ply Universal Secondary Carton L (350x250x200mm)',
    spec_category: '3-Ply Universal',
    dimensions: '350x250x200mm',
    spec_weight_kg: '0.5200',
    target_volume: 70000,
    baseline_benchmark_price: '22.0000', // Spend: 1,540,000 (3.85% - Medium)
  },
  {
    id: 'PKG-012',
    rfx_id: 'RFX-2026-CORR',
    line_number: 12,
    sku_name: '3-Ply Universal Secondary Carton M (320x220x180mm)',
    spec_category: '3-Ply Universal',
    dimensions: '320x220x180mm',
    spec_weight_kg: '0.4600',
    target_volume: 65000,
    baseline_benchmark_price: '20.0000', // Spend: 1,300,000 (3.25% - Medium)
  },
  {
    id: 'PKG-013',
    rfx_id: 'RFX-2026-CORR',
    line_number: 13,
    sku_name: '3-Ply High-Runner Distribution Box (300x200x150mm)',
    spec_category: '3-Ply Universal',
    dimensions: '300x200x150mm',
    spec_weight_kg: '0.4000',
    target_volume: 80000,
    baseline_benchmark_price: '18.0000', // Spend: 1,440,000 (3.60% - Medium)
  },
  {
    id: 'PKG-014',
    rfx_id: 'RFX-2026-CORR',
    line_number: 14,
    sku_name: '3-Ply Mid-Profile Delivery Carton (340x240x190mm)',
    spec_category: '3-Ply Universal',
    dimensions: '340x240x190mm',
    spec_weight_kg: '0.5000',
    target_volume: 50000,
    baseline_benchmark_price: '21.0000', // Spend: 1,050,000 (2.63% - Medium)
  },
  {
    id: 'PKG-015',
    rfx_id: 'RFX-2026-CORR',
    line_number: 15,
    sku_name: '3-Ply Standard Dispatch Carton (280x190x140mm)',
    spec_category: '3-Ply Universal',
    dimensions: '280x190x140mm',
    spec_weight_kg: '0.3800',
    target_volume: 60000,
    baseline_benchmark_price: '17.0000', // Spend: 1,020,000 (2.55% - Medium)
  },
  {
    id: 'PKG-016',
    rfx_id: 'RFX-2026-CORR',
    line_number: 16,
    sku_name: '3-Ply Square Dispatch Box (300x250x200mm)',
    spec_category: '3-Ply Universal',
    dimensions: '300x250x200mm',
    spec_weight_kg: '0.4800',
    target_volume: 45000,
    baseline_benchmark_price: '19.5000', // Spend: 877,500 (2.19% - Medium)
  },
  {
    id: 'PKG-017',
    rfx_id: 'RFX-2026-CORR',
    line_number: 17,
    sku_name: '3-Ply Compact Secondary Box (260x180x130mm)',
    spec_category: '3-Ply Universal',
    dimensions: '260x180x130mm',
    spec_weight_kg: '0.3500',
    target_volume: 50000,
    baseline_benchmark_price: '15.5000', // Spend: 775,000 (1.94% - Low)
  },
  {
    id: 'PKG-018',
    rfx_id: 'RFX-2026-CORR',
    line_number: 18,
    sku_name: '3-Ply Retail Dispatch Shipper (310x210x160mm)',
    spec_category: '3-Ply Universal',
    dimensions: '310x210x160mm',
    spec_weight_kg: '0.4200',
    target_volume: 40000,
    baseline_benchmark_price: '18.5000', // Spend: 740,000 (1.85% - Low)
  },
  {
    id: 'PKG-019',
    rfx_id: 'RFX-2026-CORR',
    line_number: 19,
    sku_name: '3-Ply Medium Parcel Carton (330x230x170mm)',
    spec_category: '3-Ply Universal',
    dimensions: '330x230x170mm',
    spec_weight_kg: '0.4700',
    target_volume: 35000,
    baseline_benchmark_price: '20.5000', // Spend: 717,500 (1.79% - Low)
  },
  {
    id: 'PKG-020',
    rfx_id: 'RFX-2026-CORR',
    line_number: 20,
    sku_name: '3-Ply Shallow Universal Box (350x250x150mm)',
    spec_category: '3-Ply Universal',
    dimensions: '350x250x150mm',
    spec_weight_kg: '0.4500',
    target_volume: 30000,
    baseline_benchmark_price: '19.0000', // Spend: 570,000 (1.43% - Low)
  },

  // --- Lines 21–27: Die-Cut Self-Locking Mailers (E-Flute, 0.15 - 0.25 kg, Low exposure) ---
  {
    id: 'PKG-021',
    rfx_id: 'RFX-2026-CORR',
    line_number: 21,
    sku_name: 'Die-Cut Self-Locking Mailer L (300x200x80mm)',
    spec_category: 'Die-Cut Mailer',
    dimensions: '300x200x80mm',
    spec_weight_kg: '0.2400',
    target_volume: 35000,
    baseline_benchmark_price: '16.0000', // Spend: 560,000 (1.40% - Low)
  },
  {
    id: 'PKG-022',
    rfx_id: 'RFX-2026-CORR',
    line_number: 22,
    sku_name: 'Die-Cut Self-Locking Mailer M (280x180x70mm)',
    spec_category: 'Die-Cut Mailer',
    dimensions: '280x180x70mm',
    spec_weight_kg: '0.2200',
    target_volume: 30000,
    baseline_benchmark_price: '14.5000', // Spend: 435,000 (1.09% - Low)
  },
  {
    id: 'PKG-023',
    rfx_id: 'RFX-2026-CORR',
    line_number: 23,
    sku_name: 'Die-Cut E-Commerce Box (250x160x60mm)',
    spec_category: 'Die-Cut Mailer',
    dimensions: '250x160x60mm',
    spec_weight_kg: '0.1900',
    target_volume: 40000,
    baseline_benchmark_price: '13.0000', // Spend: 520,000 (1.30% - Low)
  },
  {
    id: 'PKG-024',
    rfx_id: 'RFX-2026-CORR',
    line_number: 24,
    sku_name: 'Die-Cut Flat Presentation Mailer (240x150x55mm)',
    spec_category: 'Die-Cut Mailer',
    dimensions: '240x150x55mm',
    spec_weight_kg: '0.1800',
    target_volume: 35000,
    baseline_benchmark_price: '12.5000', // Spend: 437,500 (1.09% - Low)
  },
  {
    id: 'PKG-025',
    rfx_id: 'RFX-2026-CORR',
    line_number: 25,
    sku_name: 'Die-Cut Compact Courier Mailer (220x140x50mm)',
    spec_category: 'Die-Cut Mailer',
    dimensions: '220x140x50mm',
    spec_weight_kg: '0.1600',
    target_volume: 25000,
    baseline_benchmark_price: '11.5000', // Spend: 287,500 (0.72% - Low)
  },
  {
    id: 'PKG-026',
    rfx_id: 'RFX-2026-CORR',
    line_number: 26,
    sku_name: 'Die-Cut Mini Postal Box (200x150x50mm)',
    spec_category: 'Die-Cut Mailer',
    dimensions: '200x150x50mm',
    spec_weight_kg: '0.1500',
    target_volume: 30000,
    baseline_benchmark_price: '10.5000', // Spend: 315,000 (0.79% - Low)
  },
  {
    id: 'PKG-027',
    rfx_id: 'RFX-2026-CORR',
    line_number: 27,
    sku_name: 'Die-Cut Slim Literature Mailer (260x170x65mm)',
    spec_category: 'Die-Cut Mailer',
    dimensions: '260x170x65mm',
    spec_weight_kg: '0.2000',
    target_volume: 20000,
    baseline_benchmark_price: '13.5000', // Spend: 270,000 (0.68% - Low)
  },

  // --- Lines 28–30: Ancillary Protective Packaging (Edge protectors, Honeycomb, Tape) ---
  {
    id: 'PKG-028',
    rfx_id: 'RFX-2026-CORR',
    line_number: 28,
    sku_name: 'Heavy-Duty L-Edge Protectors (50x50x1000mm)',
    spec_category: 'Protective',
    dimensions: '50x50x1000mm',
    spec_weight_kg: '0.3000',
    target_volume: 10000,
    baseline_benchmark_price: '15.0000', // Spend: 150,000 (0.375% - Low)
  },
  {
    id: 'PKG-029',
    rfx_id: 'RFX-2026-CORR',
    line_number: 29,
    sku_name: 'Corrugated Honeycomb Buffer Sheets (1200x1000mm)',
    spec_category: 'Protective',
    dimensions: '1200x1000mm',
    spec_weight_kg: '0.9000',
    target_volume: 5000,
    baseline_benchmark_price: '85.0000', // Spend: 425,000 (1.06% - Low)
  },
  {
    id: 'PKG-030',
    rfx_id: 'RFX-2026-CORR',
    line_number: 30,
    sku_name: 'Self-Adhesive Reinforced Kraft Tape (72mm x 50m)',
    spec_category: 'Protective',
    dimensions: '72mm x 50m',
    spec_weight_kg: '0.4500',
    target_volume: 8000,
    baseline_benchmark_price: '41.2500', // Spend: 330,000 (0.825% - Low)
  },
];

// 3. 5 Vendor Profiles with Compliance Data
export const VENDORS: VendorProfile[] = [
  {
    id: 'VEND-01',
    name: 'Packaging World India',
    inbound_modality: 'MULTI_TAB_EXCEL',
    raw_document_url: '/documents/vend01_packaging_world.xlsx',
    doc_sha256: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
    iso_9001_certified: 1, // True
    fsc_certified: 1,      // True
    credit_terms: 'Net 60',
    quality_audit_score: '95.00',
  },
  {
    id: 'VEND-02',
    name: 'Apex Cartons & Containers',
    inbound_modality: 'ANGLED_PHOTO',
    raw_document_url: '/documents/vend02_apex_cartons_scan.jpg',
    doc_sha256: 'b2c3d4e5f6a17890123456789abcdef0123456789abcdef0123456789abcdef1',
    iso_9001_certified: 1, // True
    fsc_certified: 0,      // False
    credit_terms: 'Net 30',
    quality_audit_score: '88.00',
  },
  {
    id: 'VEND-03',
    name: 'National Paper & Board Mills',
    inbound_modality: 'PARTIAL_WORD',
    raw_document_url: '/documents/vend03_national_paper_quote.docx',
    doc_sha256: 'c3d4e5f6a1b27890123456789abcdef0123456789abcdef0123456789abcdef2',
    iso_9001_certified: 0, // False
    fsc_certified: 0,      // False
    credit_terms: 'Net 45',
    quality_audit_score: '52.00', // 52% Audit Score per spec
  },
  {
    id: 'VEND-04',
    name: 'Global Pack Holdings',
    inbound_modality: 'FOREIGN_USD_PDF',
    raw_document_url: '/documents/vend04_global_pack_intl.pdf',
    doc_sha256: 'd4e5f6a1b2c37890123456789abcdef0123456789abcdef0123456789abcdef3',
    iso_9001_certified: 1, // True
    fsc_certified: 1,      // True
    credit_terms: 'Net 30',
    quality_audit_score: '96.00',
  },
  {
    id: 'VEND-05',
    name: 'Balaji Traders',
    inbound_modality: 'RAW_EMAIL',
    raw_document_url: '/documents/vend05_balaji_email.txt',
    doc_sha256: 'e5f6a1b2c3d47890123456789abcdef0123456789abcdef0123456789abcdef4',
    iso_9001_certified: 1, // True
    fsc_certified: 0,      // False
    credit_terms: 'Net 15',
    quality_audit_score: '82.00',
  },
];

// 4. Initial Off-Sheet Ancillary Charges
export const ANCILLARY_CHARGES: AncillaryCharge[] = [
  {
    id: 'ANC-V1-01',
    vendor_id: 'VEND-01',
    fee_type: 'TOOLING_PLATE_FEE',
    fee_scope: 'BASKET_FIXED',
    raw_quoted_text: 'Cell D34 Tab 2: Stereo cylinder plate charge ₹25,000 one-time',
    amount_inr: '25000.00',
    percentage_value: '0.0000',
    source_location_ref: 'Cell D34 on Tab "Terms"',
  },
  {
    id: 'ANC-V5-01',
    vendor_id: 'VEND-05',
    fee_type: 'FREIGHT_SURCHARGE',
    fee_scope: 'PERCENTAGE_ON_TOTAL',
    raw_quoted_text: 'Email Body: Freight 4% extra on total invoice',
    amount_inr: '0.00',
    percentage_value: '0.0400',
    source_location_ref: 'Email body paragraph 1',
  },
];

export function seedDatabase(): void {
  const db = getDatabase();

  console.log('🌱 Starting Master Data Seeding for Aerchain QuoteEngine...');

  const seedTransaction = db.transaction(() => {
    // 1. Clear existing seed data cleanly (enforcing cascade)
    db.prepare('DELETE FROM vendor_ancillary_charges').run();
    db.prepare('DELETE FROM vendor_line_quotes').run();
    db.prepare('DELETE FROM rfx_line_items').run();
    db.prepare('DELETE FROM vendors').run();
    db.prepare('DELETE FROM rfx_master').run();

    // 2. Insert Master RFx
    const insertMaster = db.prepare(`
      INSERT INTO rfx_master (
        id, title, category, baseline_currency, usd_peg_rate, total_target_budget
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertMaster.run(
      MASTER_RFX.id,
      MASTER_RFX.title,
      MASTER_RFX.category,
      MASTER_RFX.baseline_currency,
      MASTER_RFX.usd_peg_rate,
      MASTER_RFX.total_target_budget
    );
    console.log(`  ✅ Inserted Master RFx: ${MASTER_RFX.id} (Budget: ₹${Number(MASTER_RFX.total_target_budget).toLocaleString('en-IN')})`);

    // 3. Insert Exactly 30 Canonical Line Items
    const insertItem = db.prepare(`
      INSERT INTO rfx_line_items (
        id, rfx_id, line_number, sku_name, spec_category,
        dimensions, spec_weight_kg, target_volume, baseline_benchmark_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let totalCalculatedSpend = 0;
    for (const item of CANONICAL_LINE_ITEMS) {
      insertItem.run(
        item.id,
        item.rfx_id,
        item.line_number,
        item.sku_name,
        item.spec_category,
        item.dimensions,
        item.spec_weight_kg,
        item.target_volume,
        item.baseline_benchmark_price
      );
      totalCalculatedSpend += item.target_volume * parseFloat(item.baseline_benchmark_price);
    }
    console.log(`  ✅ Inserted ${CANONICAL_LINE_ITEMS.length} Canonical Line Items.`);
    console.log(`     Total Benchmark Spend: ₹${totalCalculatedSpend.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Target: ₹4,00,00,000.00)`);

    // 4. Insert 5 Vendors
    const insertVendor = db.prepare(`
      INSERT INTO vendors (
        id, name, inbound_modality, raw_document_url, doc_sha256,
        iso_9001_certified, fsc_certified, credit_terms, quality_audit_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const vendor of VENDORS) {
      insertVendor.run(
        vendor.id,
        vendor.name,
        vendor.inbound_modality,
        vendor.raw_document_url,
        vendor.doc_sha256,
        vendor.iso_9001_certified,
        vendor.fsc_certified,
        vendor.credit_terms,
        vendor.quality_audit_score
      );
    }
    console.log(`  ✅ Inserted ${VENDORS.length} Vendor Profiles with compliance data.`);

    // 5. Insert Ancillary Charges
    const insertAncillary = db.prepare(`
      INSERT INTO vendor_ancillary_charges (
        id, vendor_id, fee_type, fee_scope, raw_quoted_text,
        amount_inr, percentage_value, source_location_ref
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const charge of ANCILLARY_CHARGES) {
      insertAncillary.run(
        charge.id,
        charge.vendor_id,
        charge.fee_type,
        charge.fee_scope,
        charge.raw_quoted_text,
        charge.amount_inr,
        charge.percentage_value,
        charge.source_location_ref
      );
    }
    console.log(`  ✅ Inserted ${ANCILLARY_CHARGES.length} Ancillary Off-Sheet Charges.`);
  });

  seedTransaction();
  console.log('🎉 Master Data Seeding completed successfully!');
}

if (require.main === module) {
  try {
    seedDatabase();
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}
