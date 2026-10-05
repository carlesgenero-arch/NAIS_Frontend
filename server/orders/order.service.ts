import { findOrderBySession, findPublicOrderBySession, insertPaidOrder, type OrderDatabase } from './order.repository.ts';
import type { PaidOrderSnapshot } from './order.types.ts';
import { isCheckoutSessionId, isPublicOrderSummary, type PublicOrderSummary } from '../../src/shared/order-summary.ts';

export async function getPublicOrder(db: OrderDatabase, sessionId: string): Promise<PublicOrderSummary | null> {
  if (!isCheckoutSessionId(sessionId)) throw new Error('Invalid session reference');
  const row = await findPublicOrderBySession(db, sessionId);
  if (!row) return null;
  const summary: unknown = {
    orderNumber: row.orderNumber, paymentStatus: row.paymentStatus,
    fulfillmentStatus: row.fulfillmentStatus, totalAmount: row.totalAmount,
    currency: row.currency, createdAt: row.createdAt, items: JSON.parse(row.itemsJson),
  };
  if (!isPublicOrderSummary(summary)) throw new Error('Invalid order snapshot');
  return summary;
}

/** Preserve the early duplicate check before Stripe data is fetched again. */
export async function hasOrderForSession(db: OrderDatabase, sessionId: string): Promise<boolean> {
  return (await findOrderBySession(db, sessionId)) !== null;
}

/** Accepts only an internal verified paid snapshot, never an HTTP/browser payload. */
export async function createPaidOrder(db: OrderDatabase, snapshot: PaidOrderSnapshot): Promise<void> {
  const id = crypto.randomUUID();
  await insertPaidOrder(db, {
    ...snapshot,
    id,
    order_number: `NAIS-${id.toUpperCase()}`,
    payment_status: 'paid',
    fulfillment_status: 'pending',
  });
}
