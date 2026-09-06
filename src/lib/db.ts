import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Guarantee data directory exists
const DB_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'aerchain.db');

let dbInstance: Database.Database | null = null;

export function getDatabase(dbPath: string = DB_PATH): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(dbPath);

    // CRITICAL GUARDRAIL: Immediately enforce foreign keys and WAL mode
    dbInstance.pragma('foreign_keys = ON;');
    dbInstance.pragma('journal_mode = WAL;');
    dbInstance.pragma('synchronous = NORMAL;');

    // Ensure rfx_dispatches table exists
    dbInstance.exec(`
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
      CREATE INDEX IF NOT EXISTS idx_rfx_dispatches_rfx_vendor ON rfx_dispatches(rfx_id, vendor_id);
    `);
  }
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export default getDatabase;
