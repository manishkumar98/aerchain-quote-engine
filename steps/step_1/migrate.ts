import fs from 'fs';
import path from 'path';
import { getDatabase, closeDatabase } from '../../src/lib/db';

export function runMigrations(): void {
  const db = getDatabase();
  const migrationsDir = fs.existsSync(path.join(__dirname, 'migrations'))
    ? path.join(__dirname, 'migrations')
    : path.join(process.cwd(), 'migrations');

  console.log('🔄 Running database migrations...');

  // Track applied migrations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const isApplied = db
      .prepare('SELECT 1 FROM schema_migrations WHERE filename = ?')
      .get(file);

    if (!isApplied) {
      console.log(`  Applying migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      // Execute within transaction
      const transaction = db.transaction(() => {
        db.exec(sql);
        db.prepare('INSERT INTO schema_migrations (filename) VALUES (?)').run(file);
      });

      transaction();
      console.log(`  ✅ Applied: ${file}`);
    } else {
      console.log(`  ⏭️  Skipped (already applied): ${file}`);
    }
  }

  console.log('✨ All migrations completed successfully.');
}

if (require.main === module) {
  try {
    runMigrations();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}
