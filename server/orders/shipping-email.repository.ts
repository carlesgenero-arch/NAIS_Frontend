import type { AdminOrderDatabase } from './order.repository.ts';

export async function claimShippingEmail(db: AdminOrderDatabase, id: string): Promise<boolean> {
  return await db.prepare(`UPDATE orders SET shipping_email_status='sending'
    WHERE id=?1 AND fulfillment_status='shipped' AND shipping_email_status='pending' RETURNING id`)
    .bind(id).first() !== null;
}
export async function finishShippingEmail(db: AdminOrderDatabase, id: string, status: 'sent' | 'failed' | 'skipped'): Promise<void> {
  await db.prepare(`UPDATE orders SET shipping_email_status=?2, shipping_email_sent_at=?3
    WHERE id=?1 AND shipping_email_status='sending' RETURNING id`)
    .bind(id, status, status === 'sent' ? new Date().toISOString() : null).first();
}
