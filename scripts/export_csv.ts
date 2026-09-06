import fs from 'fs';
import path from 'path';
import { getDatabase, closeDatabase } from '../src/lib/db';

function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function exportTableToCsv(tableName: string, outputDir: string): string {
  const db = getDatabase();
  const rows = db.prepare(`SELECT * FROM ${tableName}`).all() as Record<string, any>[];

  if (rows.length === 0) {
    console.log(`  ℹ️  Table ${tableName} is empty.`);
    const emptyPath = path.join(outputDir, `${tableName}.csv`);
    fs.writeFileSync(emptyPath, '', 'utf-8');
    return emptyPath;
  }

  const headers = Object.keys(rows[0]);
  const csvLines = [headers.map(escapeCsvCell).join(',')];

  for (const row of rows) {
    const line = headers.map((header) => escapeCsvCell(row[header])).join(',');
    csvLines.push(line);
  }

  const filePath = path.join(outputDir, `${tableName}.csv`);
  fs.writeFileSync(filePath, csvLines.join('\n'), 'utf-8');
  console.log(`  ✅ Exported ${rows.length} rows to ${path.relative(process.cwd(), filePath)}`);
  return filePath;
}

export function exportAllTables(): void {
  const outputDir = path.join(process.cwd(), 'data', 'csv');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`📁 Exporting database tables to CSV (${outputDir})...`);

  const tables = [
    'rfx_master',
    'rfx_line_items',
    'vendors',
    'vendor_ancillary_charges',
    'vendor_line_quotes',
  ];

  for (const table of tables) {
    exportTableToCsv(table, outputDir);
  }

  // Also create a combined/enriched view for easy review of the 30 items with spend calculations
  const db = getDatabase();
  const itemsWithSpend = db
    .prepare(`
      SELECT 
        l.line_number,
        l.id as sku_id,
        l.sku_name,
        l.spec_category,
        l.dimensions,
        l.spec_weight_kg,
        l.target_volume,
        l.baseline_benchmark_price as benchmark_price_inr,
        (CAST(l.target_volume AS REAL) * CAST(l.baseline_benchmark_price AS REAL)) as total_spend_inr,
        ROUND(((CAST(l.target_volume AS REAL) * CAST(l.baseline_benchmark_price AS REAL)) / CAST(m.total_target_budget AS REAL)) * 100, 2) as spend_pct_of_budget,
        CASE 
          WHEN ((CAST(l.target_volume AS REAL) * CAST(l.baseline_benchmark_price AS REAL)) / CAST(m.total_target_budget AS REAL)) >= 0.05 THEN 'HIGH'
          WHEN ((CAST(l.target_volume AS REAL) * CAST(l.baseline_benchmark_price AS REAL)) / CAST(m.total_target_budget AS REAL)) >= 0.02 THEN 'MEDIUM'
          ELSE 'LOW'
        END as financial_exposure
      FROM rfx_line_items l
      JOIN rfx_master m ON l.rfx_id = m.id
      ORDER BY l.line_number ASC
    `)
    .all() as Record<string, any>[];

  if (itemsWithSpend.length > 0) {
    const summaryHeaders = Object.keys(itemsWithSpend[0]);
    const summaryLines = [summaryHeaders.map(escapeCsvCell).join(',')];
    for (const row of itemsWithSpend) {
      summaryLines.push(summaryHeaders.map((h) => escapeCsvCell(row[h])).join(','));
    }
    const summaryPath = path.join(outputDir, 'rfx_catalog_spend_analysis.csv');
    fs.writeFileSync(summaryPath, summaryLines.join('\n'), 'utf-8');
    console.log(`  ✅ Exported enriched spend analysis to ${path.relative(process.cwd(), summaryPath)}`);
  }

  console.log('✨ All CSV exports complete!');
}

if (require.main === module) {
  try {
    exportAllTables();
  } catch (err) {
    console.error('❌ Export failed:', err);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}
