import { sendEmail } from '../email/email.service.ts';
import type { EmailEnvironment } from '../email/email.types.ts';
import type { OrderDatabase } from './order.repository.ts';
import { claimNotification, readNotification, finishNotification } from './order-notification.repository.ts';
import { notificationMessage } from './order-notification.template.ts';

export interface OrderNotificationEnvironment extends EmailEnvironment {
  readonly ORDER_NOTIFICATION_EMAIL?: string;
}
/** One automatic attempt per persisted paid order, independent of customer mail. */
export async function notifyNewOrder(db: OrderDatabase, session: string, env: OrderNotificationEnvironment): Promise<void> {
  try {
    if (!await claimNotification(db, session)) return;
  } catch { console.warn('order_notification_claim_unavailable'); return; }
  let accepted = false;
  try {
    const recipient = env.ORDER_NOTIFICATION_EMAIL?.trim();
    const order = await readNotification(db, session);
    if (recipient && order) accepted = (await sendEmail(notificationMessage(order, recipient), env)).ok;
  } catch { /* Persist a generic failure; never log snapshot/provider content. */ }
  try { await finishNotification(db, session, accepted ? 'sent' : 'failed'); }
  catch { console.warn('order_notification_state_unavailable'); } // Ambiguous sending stays claimed.
}
