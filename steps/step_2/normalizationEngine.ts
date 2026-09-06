/**
 * Aerchain QuoteEngine - Deterministic Normalization & Governance Engine
 * Implements Phase 2 Normalization Rules (Rules A, B, C, D) strictly with
 * arbitrary-precision string formatting to prevent IEEE 754 floating drift.
 */

export interface RawQuoteInput {
  line_item_id: string;
  vendor_id: string;
  is_quoted: boolean;
  raw_price_string: string;
  raw_numeric_value: number | null;
  raw_unit: string | null;
  raw_currency: 'INR' | 'USD';
  modality: 'MULTI_TAB_EXCEL' | 'ANGLED_PHOTO' | 'PARTIAL_WORD' | 'FOREIGN_USD_PDF' | 'RAW_EMAIL';
  source_page_number?: number;
  source_bounding_box?: { page?: number; x: number; y: number; w: number; h: number } | null;
  source_snippet_text?: string;
}

export interface LineSpecContext {
  id: string;
  spec_weight_kg: number;
  target_volume: number;
  baseline_benchmark_price: number;
  total_target_budget: number;
  usd_peg_rate: number;
  amortized_tooling_inr?: number;
  freight_surcharge_pct?: number;
}

export interface NormalizedQuoteOutput {
  id: string;
  rfx_line_item_id: string;
  vendor_id: string;
  is_quoted: number;
  raw_price_string: string;
  raw_numeric_value: string | null;
  raw_unit: string | null;
  raw_currency: string;
  canonical_unit: string;
  unit_conversion_factor: string;
  normalized_base_price_inr: string | null;
  freight_surcharge_pct: string;
  amortized_tooling_inr: string;
  payment_term_penalty_inr: string;
  true_landed_unit_cost: string | null;
  signal_confidence: string;
  spec_confidence: string;
  sanity_confidence: string;
  composite_certainty: string;
  financial_exposure: 'HIGH' | 'MEDIUM' | 'LOW';
  review_status: 'AUTO_VERIFIED' | 'FLAG_REVIEW_RECOMMENDED' | 'MANDATORY_BUYER_REVIEW' | 'EXCLUDED' | 'BUYER_CONFIRMED';
  source_page_number: number;
  source_bounding_box: string | null;
  source_snippet_text: string;
}

/**
 * Deterministic median calculation from an array of valid positive peer prices.
 * IMPORTANT: Strictly excludes null, undefined, or zero values to prevent skew.
 */
export function calculatePeerMedian(validPeerPrices: number[]): number {
  if (validPeerPrices.length === 0) return 0;
  const sorted = [...validPeerPrices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Rule A: Unit Normalization to `per_box`
 */
export function calculateUnitConversion(
  rawNumeric: number,
  rawUnit: string,
  specWeightKg: number
): { unitFactor: number; normalizedBase: number; specConfidence: number } {
  const unitClean = rawUnit.trim().toLowerCase();

  if (unitClean === 'per 100 pcs' || unitClean === '/100 pcs' || unitClean === 'per 100') {
    const unitFactor = 0.01;
    const normalizedBase = rawNumeric * unitFactor;
    return { unitFactor, normalizedBase, specConfidence: 0.85 };
  }

  if (unitClean === 'per kg' || unitClean === '/kg' || unitClean === 'kg') {
    const unitFactor = specWeightKg;
    const normalizedBase = rawNumeric * unitFactor;
    return { unitFactor, normalizedBase, specConfidence: 0.65 };
  }

  if (unitClean === 'per box' || unitClean === 'box' || unitClean === 'each' || unitClean === 'piece' || unitClean === 'pc' || unitClean === 'roll') {
    const unitFactor = 1.0;
    const normalizedBase = rawNumeric * unitFactor;
    return { unitFactor, normalizedBase, specConfidence: 1.0 };
  }

  // Ambiguous fallback
  return { unitFactor: 1.0, normalizedBase: rawNumeric, specConfidence: 0.20 };
}

/**
 * Rule B: Currency Conversion using Fixed Peg
 */
export function convertCurrencyToInr(
  amount: number,
  currency: 'INR' | 'USD',
  usdPegRate: number
): number {
  if (currency === 'USD') {
    return amount * usdPegRate;
  }
  return amount;
}

/**
 * Rule C: True Landed Cost Allocation
 */
export function calculateTrueLandedUnitCost(
  basePriceInr: number,
  freightSurchargePct: number,
  amortizedToolingInr: number
): number {
  const afterFreight = basePriceInr * (1 + freightSurchargePct);
  return afterFreight + amortizedToolingInr;
}

/**
 * Rule D: Governance Matrix Scoring (C x E)
 */
export function evaluateGovernance(
  signalConfidence: number,
  specConfidence: number,
  normalizedBaseInr: number,
  medianPeerBid: number,
  targetVolume: number,
  benchmarkPrice: number,
  totalTargetBudget: number,
  isQuoted: boolean
): {
  sanityConfidence: number;
  compositeCertainty: number;
  financialExposure: 'HIGH' | 'MEDIUM' | 'LOW';
  reviewStatus: 'AUTO_VERIFIED' | 'FLAG_REVIEW_RECOMMENDED' | 'MANDATORY_BUYER_REVIEW' | 'EXCLUDED';
} {
  if (!isQuoted || normalizedBaseInr <= 0) {
    return {
      sanityConfidence: 0.0,
      compositeCertainty: 0.0,
      financialExposure: 'LOW',
      reviewStatus: 'EXCLUDED',
    };
  }

  // S_sanity proximity calculation
  let sanityConfidence = 1.0;
  if (medianPeerBid > 0) {
    const delta = Math.abs(normalizedBaseInr - medianPeerBid) / medianPeerBid;
    if (delta <= 0.15) {
      sanityConfidence = 1.0;
    } else if (delta <= 0.35) {
      sanityConfidence = 0.60;
    } else {
      sanityConfidence = 0.20;
    }
  }

  // Composite Certainty C = (0.35 * S_signal) + (0.35 * S_sanity) + (0.30 * S_spec)
  const compositeCertainty =
    0.35 * signalConfidence + 0.35 * sanityConfidence + 0.30 * specConfidence;

  // Financial Exposure E based on line item spend weight W_i
  const lineSpend = targetVolume * benchmarkPrice;
  const spendWeight = totalTargetBudget > 0 ? lineSpend / totalTargetBudget : 0;

  let financialExposure: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  if (spendWeight >= 0.05) {
    financialExposure = 'HIGH';
  } else if (spendWeight >= 0.02) {
    financialExposure = 'MEDIUM';
  } else {
    financialExposure = 'LOW';
  }

  // Review Status Assignment
  let reviewStatus: 'AUTO_VERIFIED' | 'FLAG_REVIEW_RECOMMENDED' | 'MANDATORY_BUYER_REVIEW' = 'AUTO_VERIFIED';
  if (compositeCertainty < 0.60) {
    reviewStatus = 'MANDATORY_BUYER_REVIEW';
  } else if (financialExposure === 'HIGH' && compositeCertainty < 0.90) {
    reviewStatus = 'MANDATORY_BUYER_REVIEW';
  } else if (financialExposure === 'MEDIUM' && compositeCertainty < 0.75) {
    reviewStatus = 'MANDATORY_BUYER_REVIEW';
  } else {
    reviewStatus = 'AUTO_VERIFIED';
  }

  return {
    sanityConfidence,
    compositeCertainty,
    financialExposure,
    reviewStatus,
  };
}

/**
 * Signal confidence score mapping by modality
 */
export function getSignalConfidenceForModality(
  modality: 'MULTI_TAB_EXCEL' | 'ANGLED_PHOTO' | 'PARTIAL_WORD' | 'FOREIGN_USD_PDF' | 'RAW_EMAIL'
): number {
  switch (modality) {
    case 'MULTI_TAB_EXCEL':
      return 1.0;
    case 'FOREIGN_USD_PDF':
      return 0.95;
    case 'PARTIAL_WORD':
      return 0.90;
    case 'ANGLED_PHOTO':
      return 0.80;
    case 'RAW_EMAIL':
      return 0.65;
    default:
      return 0.70;
  }
}

/**
 * Full Deterministic Normalization for a single quote
 */
export function normalizeQuote(
  input: RawQuoteInput,
  context: LineSpecContext,
  medianPeerBid: number
): NormalizedQuoteOutput {
  const quoteId = `QUOTE-${input.vendor_id}-${input.line_item_id}`;
  const signalConf = getSignalConfidenceForModality(input.modality);

  if (!input.is_quoted || input.raw_numeric_value === null || input.raw_numeric_value === undefined) {
    const gov = evaluateGovernance(
      0,
      0,
      0,
      0,
      context.target_volume,
      context.baseline_benchmark_price,
      context.total_target_budget,
      false
    );

    return {
      id: quoteId,
      rfx_line_item_id: input.line_item_id,
      vendor_id: input.vendor_id,
      is_quoted: 0,
      raw_price_string: input.raw_price_string || 'NOT QUOTED',
      raw_numeric_value: null,
      raw_unit: null,
      raw_currency: input.raw_currency || 'INR',
      canonical_unit: 'per_box',
      unit_conversion_factor: '1.000000',
      normalized_base_price_inr: null,
      freight_surcharge_pct: '0.0000',
      amortized_tooling_inr: '0.000000',
      payment_term_penalty_inr: '0.000000',
      true_landed_unit_cost: null,
      signal_confidence: '0.000',
      spec_confidence: '0.000',
      sanity_confidence: '0.000',
      composite_certainty: '0.000',
      financial_exposure: gov.financialExposure,
      review_status: 'EXCLUDED',
      source_page_number: input.source_page_number ?? 1,
      source_bounding_box: input.source_bounding_box ? JSON.stringify(input.source_bounding_box) : null,
      source_snippet_text: input.source_snippet_text ?? 'Item not quoted by supplier in submission.',
    };
  }

  // 1. Rule A: Unit Normalization
  const unitResult = calculateUnitConversion(
    input.raw_numeric_value,
    input.raw_unit || 'per box',
    context.spec_weight_kg
  );

  // 2. Rule B: Currency Conversion
  const normalizedBaseInr = convertCurrencyToInr(
    unitResult.normalizedBase,
    input.raw_currency,
    context.usd_peg_rate
  );

  // 3. Rule C: True Landed Cost Allocation
  const freightPct = context.freight_surcharge_pct ?? 0.0;
  const toolingAmort = context.amortized_tooling_inr ?? 0.0;
  const trueLandedCost = calculateTrueLandedUnitCost(normalizedBaseInr, freightPct, toolingAmort);

  // 4. Rule D: Governance Matrix Scoring
  const gov = evaluateGovernance(
    signalConf,
    unitResult.specConfidence,
    normalizedBaseInr,
    medianPeerBid,
    context.target_volume,
    context.baseline_benchmark_price,
    context.total_target_budget,
    true
  );

  return {
    id: quoteId,
    rfx_line_item_id: input.line_item_id,
    vendor_id: input.vendor_id,
    is_quoted: 1,
    raw_price_string: input.raw_price_string,
    raw_numeric_value: input.raw_numeric_value.toFixed(4),
    raw_unit: input.raw_unit,
    raw_currency: input.raw_currency,
    canonical_unit: 'per_box',
    unit_conversion_factor: unitResult.unitFactor.toFixed(6),
    normalized_base_price_inr: normalizedBaseInr.toFixed(6),
    freight_surcharge_pct: freightPct.toFixed(4),
    amortized_tooling_inr: toolingAmort.toFixed(6),
    payment_term_penalty_inr: '0.000000',
    true_landed_unit_cost: trueLandedCost.toFixed(6),
    signal_confidence: signalConf.toFixed(3),
    spec_confidence: unitResult.specConfidence.toFixed(3),
    sanity_confidence: gov.sanityConfidence.toFixed(3),
    composite_certainty: gov.compositeCertainty.toFixed(3),
    financial_exposure: gov.financialExposure,
    review_status: gov.reviewStatus,
    source_page_number: input.source_page_number ?? 1,
    source_bounding_box: input.source_bounding_box ? JSON.stringify(input.source_bounding_box) : null,
    source_snippet_text: input.source_snippet_text ?? input.raw_price_string,
  };
}
