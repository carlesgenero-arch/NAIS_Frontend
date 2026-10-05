/** Public API contract only. Never include customer data or internal identifiers. */
export interface PublicOrderItem {
  readonly productName: string;
  readonly quantity: number;
  readonly unitAmount: number;
  readonly lineTotalAmount: number;
}
export interface PublicOrderSummary {
  readonly orderNumber: string;
  readonly paymentStatus: 'paid' | 'partially_refunded' | 'refunded';
  readonly fulfillmentStatus: 'pending' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';
  readonly totalAmount: number;
  readonly currency: string;
  readonly createdAt: string;
  readonly items: readonly PublicOrderItem[];
}

export function isCheckoutSessionId(value: unknown): value is string {
  return typeof value === 'string' && /^cs_(?:test_|live_)?[a-zA-Z0-9]{24,200}$/.test(value);
}

export function isPublicOrderSummary(value: unknown): value is PublicOrderSummary {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  const cents = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
  return typeof row['orderNumber'] === 'string' && row['orderNumber'].length > 0 && row['orderNumber'].length <= 128
    && typeof row['paymentStatus'] === 'string' && ['paid', 'partially_refunded', 'refunded'].includes(row['paymentStatus'])
    && typeof row['fulfillmentStatus'] === 'string' && ['pending', 'preparing', 'shipped', 'delivered', 'cancelled'].includes(row['fulfillmentStatus'])
    && cents(row['totalAmount']) && typeof row['currency'] === 'string' && /^[a-zA-Z]{3}$/.test(row['currency'])
    && typeof row['createdAt'] === 'string' && Number.isFinite(Date.parse(row['createdAt']))
    && Array.isArray(row['items']) && row['items'].length > 0 && row['items'].every(item =>
      item && typeof item === 'object' && typeof item.productName === 'string' && item.productName.trim()
      && cents(item.quantity) && item.quantity > 0 && cents(item.unitAmount) && cents(item.lineTotalAmount));
}
