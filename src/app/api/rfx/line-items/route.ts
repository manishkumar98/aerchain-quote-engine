import { NextResponse } from 'next/server';
import {
  parseLineItemsDualLayer,
  overwriteCatalogWithLineItems,
  restoreCanonicalCatalog,
  ParsedLineItem,
} from '@/lib/catalogService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { prompt, line_items, reset } = body;

    if (reset) {
      const result = restoreCanonicalCatalog();
      return NextResponse.json({
        success: true,
        message: 'Restored canonical 30-SKU catalog and baseline quotes.',
        count: result.count,
        total_basket_volume: result.total_basket_volume,
        total_target_budget_inr: result.total_target_budget_inr,
      });
    }

    let itemsToApply: ParsedLineItem[] = [];

    if (Array.isArray(line_items) && line_items.length > 0) {
      itemsToApply = line_items;
    } else if (prompt && typeof prompt === 'string' && prompt.trim()) {
      itemsToApply = await parseLineItemsDualLayer(prompt);
    } else {
      return NextResponse.json(
        { error: 'Provide prompt text, line_items array, or reset: true' },
        { status: 400 }
      );
    }

    if (itemsToApply.length === 0) {
      return NextResponse.json(
        { error: 'No line items could be parsed from the provided input' },
        { status: 400 }
      );
    }

    const result = overwriteCatalogWithLineItems(itemsToApply);

    return NextResponse.json({
      success: true,
      message: `Successfully overwrote catalog with ${result.count} line items.`,
      count: result.count,
      total_basket_volume: result.total_basket_volume,
      total_target_budget_inr: result.total_target_budget_inr,
      lines: result.lines,
    });
  } catch (err: any) {
    console.error('[API /api/rfx/line-items] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to update catalog line items' },
      { status: 500 }
    );
  }
}
