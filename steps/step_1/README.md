# Step 1: Database Setup, Schema Migration & Master Data Seeding

This folder contains all artifacts, migration scripts, and master seed definitions for **Step 1**.

## Directory Contents

- `migrations/001_initial_schema.sql`: DDL for SQLite containing `rfx_master`, `rfx_line_items`, `vendors`, `vendor_line_quotes`, and `vendor_ancillary_charges` with arbitrary-precision `TEXT` representations.
- `migrate.ts`: Schema migration runner tracking applied migrations with transaction safety.
- `seed.ts`: Seed script populating:
  - Master RFx `RFX-2026-CORR` (Budget: ₹4.0 Cr, Peg: 84.0000 USD/INR).
  - 30 canonical packaging SKUs with exact spend math totaling ₹4,00,00,000.00.
  - 5 vendor compliance profiles (ISO/FSC flags, credit terms, audit scores).
  - Initial off-sheet ancillary charges (Tooling plate fee ₹25k and Freight 4%).
- `verify.ts`: Automated test suite with 28 tests verifying foreign keys, counts, weights, spend math, and vendor profiles.

## Commands

```bash
# Run migrations
npx tsx steps/step_1/migrate.ts

# Seed master data
npx tsx steps/step_1/seed.ts

# Run Step 1 verification
npx tsx steps/step_1/verify.ts
```
