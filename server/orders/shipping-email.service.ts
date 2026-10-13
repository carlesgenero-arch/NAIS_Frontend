import { sendEmail } from '../email/email.service.ts';
import type { EmailEnvironment } from '../email/email.types.ts';
import type { AdminOrder } from './admin-order.types.ts';
import type { AdminOrderDatabase } from './order.repository.ts';
import { claimShippingEmail, finishShippingEmail } from './shipping-email.repository.ts';
import { shippingMessage } from './shipping-email.template.ts';

/** Returns only a safe warning flag. At most one automatic attempt, independently of confirmation. */
export async function sendShippingEmail(db: AdminOrderDatabase, order: AdminOrder, env: EmailEnvironment): Promise<boolean> {
  try { if (!await claimShippingEmail(db, order.id)) return true; }
  catch { return true; }
  let status: 'sent' | 'failed' | 'skipped' = 'failed';
  try {
    if (!order.customer.email.trim()) status = 'skipped';
    else if ((await sendEmail(shippingMessage(order), env)).ok) status = 'sent';
  } catch { /* Never expose customer/provider data or undo shipment. */ }
  try { await finishShippingEmail(db, order.id, status); }
  catch { return true; } // Leave ambiguous sending state reserved, never auto-reclaim.
  return status !== 'sent';
}
