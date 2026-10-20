import type { OrderDatabase } from './order.repository.ts';
import { readConfirmation, type ConfirmationSnapshot } from './order-confirmation.repository.ts';

export type NotificationSnapshot = ConfirmationSnapshot & { payment_status: string; fulfillment_status: string };

export async function claimNotification(db: OrderDatabase, session: string): Promise<boolean> {
  return await db.prepare(`UPDATE orders SET notification_email_status='sending'
    WHERE stripe_checkout_session_id=?1 AND payment_status='paid'
    AND notification_email_status='pending' RETURNING id`).bind(session).first() !== null;
}
export async function readNotification(db: OrderDatabase, session: string): Promise<NotificationSnapshot | null> {
  const snapshot = await readConfirmation(db, session);
  if (!snapshot) return null;
  const states = await db.prepare(`SELECT payment_status, fulfillment_status FROM orders
    WHERE stripe_checkout_session_id=?1 AND payment_status='paid'`)
    .bind(session).first<{ payment_status: string; fulfillment_status: string }>();
  return states ? { ...snapshot, ...states } : null;
}
export async function finishNotification(db: OrderDatabase, session: string, status: 'sent' | 'failed'): Promise<void> {
  await db.prepare(`UPDATE orders SET notification_email_status=?2, notification_email_sent_at=?3
    WHERE stripe_checkout_session_id=?1 AND notification_email_status='sending' RETURNING id`)
    .bind(session, status, status === 'sent' ? new Date().toISOString() : null).first();
}
