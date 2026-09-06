import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import crypto from 'crypto';

interface VendorRecipient {
  vendor_id: string;
  vendor_name: string;
  recipient_email: string;
  reply_to_email: string;
  inbound_modality: string;
}

const VENDOR_REGISTRY: Record<string, VendorRecipient> = {
  'VEND-01': {
    vendor_id: 'VEND-01',
    vendor_name: 'Packaging World Ltd',
    recipient_email: 'vendor1@packagingworld.in',
    reply_to_email: 'rfx-corr-2026-v1@ingest.aerchain.ai',
    inbound_modality: 'MULTI_TAB_EXCEL',
  },
  'VEND-02': {
    vendor_id: 'VEND-02',
    vendor_name: 'Apex Cartons & Containers',
    recipient_email: 'vendor2@apexcartons.com',
    reply_to_email: 'rfx-corr-2026-v2@ingest.aerchain.ai',
    inbound_modality: 'ANGLED_PHOTO',
  },
  'VEND-03': {
    vendor_id: 'VEND-03',
    vendor_name: 'National Paper & Board Mills',
    recipient_email: 'vendor3@nationalpaper.co.in',
    reply_to_email: 'rfx-corr-2026-v3@ingest.aerchain.ai',
    inbound_modality: 'PARTIAL_WORD',
  },
  'VEND-04': {
    vendor_id: 'VEND-04',
    vendor_name: 'Global Packaging Export LLC',
    recipient_email: 'vendor4@globalpack.com',
    reply_to_email: 'rfx-corr-2026-v4@ingest.aerchain.ai',
    inbound_modality: 'FOREIGN_USD_PDF',
  },
  'VEND-05': {
    vendor_id: 'VEND-05',
    vendor_name: 'Balaji Traders',
    recipient_email: 'vendor5@balajitraders.in',
    reply_to_email: 'rfx-corr-2026-v5@ingest.aerchain.ai',
    inbound_modality: 'RAW_EMAIL',
  },
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rfxId = body.rfx_id || 'RFX-2026-CORR';
    const targetVendorIds: string[] = Array.isArray(body.vendor_ids) && body.vendor_ids.length > 0
      ? body.vendor_ids
      : Object.keys(VENDOR_REGISTRY);

    const db = getDatabase();

    const insertDispatch = db.prepare(`
      INSERT OR REPLACE INTO rfx_dispatches (
        id, rfx_id, vendor_id, recipient_email, reply_to_email,
        dispatch_token, status, dispatched_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const dispatches: any[] = [];

    const runTransaction = db.transaction(() => {
      for (const vid of targetVendorIds) {
        const info = VENDOR_REGISTRY[vid];
        if (!info) continue;

        const dispatchId = `DISP-${rfxId}-${vid}-${Date.now()}`;
        const token = crypto.randomBytes(16).toString('hex');

        insertDispatch.run(
          dispatchId,
          rfxId,
          info.vendor_id,
          info.recipient_email,
          info.reply_to_email,
          token,
          'DELIVERED'
        );

        dispatches.push({
          dispatch_id: dispatchId,
          vendor_id: info.vendor_id,
          vendor_name: info.vendor_name,
          recipient_email: info.recipient_email,
          reply_to_email: info.reply_to_email,
          dispatch_token: token,
          inbound_modality: info.inbound_modality,
          status: 'DELIVERED',
          dispatched_at: new Date().toISOString(),
        });
      }
    });

    runTransaction();

    return NextResponse.json({
      success: true,
      rfx_id: rfxId,
      dispatched_count: dispatches.length,
      dispatches,
      message: `Successfully simulated outbound RFx dispatch to ${dispatches.length} suppliers with tokenized reply-to routes.`,
    });
  } catch (err: any) {
    console.error('[RFx Dispatch] Route error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to dispatch RFx to vendors' },
      { status: 500 }
    );
  }
}
