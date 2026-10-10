import { sendEmail } from '../email/email.service.ts';
import type { EmailEnvironment } from '../email/email.types.ts';
import type { OrderDatabase } from './order.repository.ts';
import { claimConfirmation, readConfirmation, finishConfirmation } from './order-confirmation.repository.ts';
import { confirmationMessage } from './order-confirmation.template.ts';

/** At most one automatic attempt. Never let mail failures invalidate a persisted order. */
export async function confirmOrderEmail(db: OrderDatabase, session: string, env: EmailEnvironment): Promise<void> {
  try {
    if (!await claimConfirmation(db, session)) return;
  } catch { return; } // No confirmed ownership: never send.
  let accepted = false;
  try {
    const order = await readConfirmation(db, session);
    if (order?.customer_email?.trim()) accepted = (await sendEmail(confirmationMessage(order), env)).ok;
  } catch { /* Snapshot/read/provider failure remains recoverable without exposing details. */ }
  try { await finishConfirmation(db, session, accepted ? 'sent' : 'failed'); }
  catch { /* Keep sending on ambiguous persistence failure; never automatically reclaim it. */ }
}
