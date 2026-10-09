import { FULFILLMENT_TRANSITIONS, type FulfillmentStatus } from '../../src/shared/order-fulfillment.ts';
import { getAdminOrder, isOrderId } from './admin-order.service.ts';
import { updateOrderFulfillment, type AdminOrderDatabase } from './order.repository.ts';

export class FulfillmentError extends Error {
  readonly status: 400 | 404 | 409;
  readonly code: string;
  constructor(status: 400 | 404 | 409, code: string) { super(code); this.status = status; this.code = code; }
}
export async function changeOrderFulfillment(db: AdminOrderDatabase, id: unknown, payload: unknown) {
  if (!isOrderId(id) || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new FulfillmentError(400, 'invalid_payload');
  }
  const row = payload as Record<string, unknown>;
  const next = row['fulfillmentStatus'];
  if (Object.keys(row).length !== 1 || typeof next !== 'string'
    || !Object.hasOwn(FULFILLMENT_TRANSITIONS, next)) throw new FulfillmentError(400, 'invalid_payload');
  const order = await getAdminOrder(db, id);
  if (!order) throw new FulfillmentError(404, 'not_found');
  if (!FULFILLMENT_TRANSITIONS[order.fulfillmentStatus].includes(next as FulfillmentStatus)) {
    throw new FulfillmentError(409, 'invalid_fulfillment_transition');
  }
  if (!await updateOrderFulfillment(db, id, order.fulfillmentStatus, next as FulfillmentStatus)) {
    throw new FulfillmentError(409, 'order_changed');
  }
  return getAdminOrder(db, id);
}
