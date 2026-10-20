import { getAdminOrder, isOrderId } from './admin-order.service.ts';
import type { AdminOrderDatabase } from './order.repository.ts';

export class OrderArchiveError extends Error {
  readonly status: 400 | 404 | 409;
  readonly code: string;
  constructor(status: 400 | 404 | 409, code: string) { super(code); this.status = status; this.code = code; }
}
/** No fulfillment transition, payment write or email side effect. Repeated actions are idempotent. */
export async function setOrderArchived(db: AdminOrderDatabase, id: unknown, archived: boolean) {
  if (!isOrderId(id)) throw new OrderArchiveError(400, 'invalid_request');
  const current = await getAdminOrder(db, id);
  if (!current) throw new OrderArchiveError(404, 'not_found');
  if (current.fulfillmentStatus !== 'delivered') throw new OrderArchiveError(409, 'not_archivable');
  await db.prepare(`UPDATE orders SET archived_at=?2 WHERE id=?1 AND fulfillment_status='delivered'
    AND archived_at IS ${archived ? '' : 'NOT '}NULL RETURNING id`)
    .bind(id, archived ? new Date().toISOString() : null).first();
  const updated = await getAdminOrder(db, id);
  if (!updated) throw new OrderArchiveError(404, 'not_found');
  if (updated.fulfillmentStatus !== 'delivered') throw new OrderArchiveError(409, 'not_archivable');
  return updated;
}
