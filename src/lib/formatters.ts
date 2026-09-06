/**
 * Shared currency and number formatters for enterprise procurement displays
 */

/**
 * Format numbers in Indian numbering system (e.g. ₹3,18,42,000.00)
 */
export function formatINR(amount: number): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const fixed = absAmount.toFixed(2);
  const parts = fixed.split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1];

  // Indian comma grouping: last 3 digits, then groups of 2 digits
  let result = '';
  if (integerPart.length > 3) {
    const last3 = integerPart.substring(integerPart.length - 3);
    const remaining = integerPart.substring(0, integerPart.length - 3);
    result = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  } else {
    result = integerPart;
  }

  return `${isNegative ? '-' : ''}₹${result}.${decimalPart}`;
}

/**
 * Format large INR numbers as Lakhs / Crores for executive summaries
 */
export function formatINRExecutive(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (abs >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} Lakh`;
  }
  return formatINR(amount);
}
