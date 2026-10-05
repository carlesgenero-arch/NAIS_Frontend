import { findOrderBySession, insertPaidOrder, type OrderDatabase } from './order.repository.ts';
import type { PaidOrderSnapshot } from './order.types.ts';

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
