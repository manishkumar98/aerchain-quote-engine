import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { runIngestionPipeline } from '../../../../../steps/step_2/ingest';
import { ingestVendorSubmission } from '@/lib/inboundExtractionService';
import { getDatabase } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';

    // =========================================================================
    // Case 1: multipart/form-data (Custom File Upload and/or Raw Email Text)
    // =========================================================================
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const vendorId = (formData.get('vendor_id') as string) || 'VEND-05';
      const rawText = (formData.get('raw_text') as string) || '';
      const file = formData.get('attachment') as File | null;

      let savedFilePath: string | undefined;
      let sourceFileName: string | undefined;
      let docSha256: string | undefined;

      if (file && typeof file.name === 'string' && file.size > 0) {
        sourceFileName = file.name;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Compute SHA-256 Digest
        docSha256 = crypto.createHash('sha256').update(buffer).digest('hex');

        // Checkpoint 1: Directory check before writing to public/uploads
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Stable relative filename for Evidence Drawer preview
        const sanitizedExt = path.extname(file.name) || '.dat';
        const targetFilename = `${docSha256.substring(0, 16)}_${Date.now()}${sanitizedExt}`;
        savedFilePath = path.join(uploadsDir, targetFilename);

        fs.writeFileSync(savedFilePath, buffer);
      }

      // Execute atomic normalization & persistence
      const result = await ingestVendorSubmission({
        vendorId,
        rawText,
        filePath: savedFilePath,
        sourceFileName,
        docSha256,
      });

      return NextResponse.json({
        success: true,
        type: 'CUSTOM_SUBMISSION',
        vendor_id: result.vendorId,
        quotes_ingested: result.quotesIngested,
        doc_sha256: result.docSha256,
        file_url: savedFilePath ? `/uploads/${path.basename(savedFilePath)}` : null,
        review_distribution: result.reviewDistribution,
        message: `Successfully processed inbound submission for ${vendorId} with ${result.quotesIngested} normalized line items.`,
      });
    }

    // =========================================================================
    // Case 2: JSON Payload (Batch Presets Simulation or Programmatic Webhook)
    // =========================================================================
    const body = await request.json().catch(() => ({}));
    const batchPresets = body.batch_presets === true || body.simulate_all === true;
    const vendorId = body.vendor_id;
    const rawText = body.raw_text || '';

    if (batchPresets) {
      // Execute the deterministic 5-vendor multi-modal ingestion pipeline
      runIngestionPipeline();

      const db = getDatabase();
      const countRes = db.prepare('SELECT COUNT(*) as cnt FROM vendor_line_quotes').get() as { cnt: number };
      const statusCounts = db.prepare(`
        SELECT review_status, COUNT(*) as cnt
        FROM vendor_line_quotes
        GROUP BY review_status
      `).all() as { review_status: string; cnt: number }[];

      return NextResponse.json({
        success: true,
        type: 'BATCH_PRESETS',
        quotes_ingested: countRes.cnt,
        status_distribution: statusCounts,
        message: 'Successfully batch-ingested all 5 heterogeneous supplier presets into SQLite.',
      });
    }

    // Single vendor text-based submission
    if (vendorId) {
      const result = await ingestVendorSubmission({
        vendorId,
        rawText,
      });

      return NextResponse.json({
        success: true,
        type: 'SINGLE_VENDOR_TEXT',
        vendor_id: result.vendorId,
        quotes_ingested: result.quotesIngested,
        doc_sha256: result.docSha256,
        review_distribution: result.reviewDistribution,
        message: `Successfully processed inbound email quote for ${vendorId}.`,
      });
    }

    return NextResponse.json(
      { error: 'Invalid payload: provide vendor_id and raw_text, or batch_presets: true' },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('[Email Inbound Webhook] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to process inbound submission' },
      { status: 500 }
    );
  }
}
