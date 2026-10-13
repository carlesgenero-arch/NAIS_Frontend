import { sendEmail } from '../email/email.service.ts';
import type { EmailEnvironment, EmailMessage } from '../email/email.types.ts';
import type { PromoDatabase } from './promo-signup.ts';

function escape(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

export function promoMessage(email: string, code: string): EmailMessage {
  const lines = ['NAIS — Un 10% per a la teva primera comanda',
    'Gràcies per descobrir NAIS! Utilitza aquest codi al pagament per obtenir un 10% de descompte:',
    code, 'Codi d’un sol ús, vàlid per a la primera comanda.'];
  return { to: email, subject: 'NAIS — El teu codi del 10%', text: lines.join('\n\n'),
    html: `<main lang="ca"><h1>${escape(lines[0])}</h1>${lines.slice(1).map(line => `<p>${escape(line)}</p>`).join('')}</main>` };
}

/** Only the atomic claim winner sends. Failed/ambiguous attempts need controlled
 * reconciliation; repeating a signup must never resend or generate another code. */
export async function deliverPromo(db: PromoDatabase, requestId: string, env: EmailEnvironment): Promise<boolean> {
  const claimed = await db.prepare(
    "UPDATE promo_signups SET delivery_status = 'sending' WHERE promotion_request_id = ?1 AND delivery_status = 'pending' AND stripe_promotion_code_id IS NOT NULL AND promotion_code IS NOT NULL",
  ).bind(requestId).run();
  if (!claimed.success || claimed.meta.changes !== 1) return false;
  const row = await db.prepare(
    'SELECT email, promotion_code FROM promo_signups WHERE promotion_request_id = ?1',
  ).bind(requestId).first<{ email: string; promotion_code: string }>();
  if (!row) return false;
  const result = await sendEmail(promoMessage(row.email, row.promotion_code), env);
  const saved = await db.prepare(result.ok
    ? "UPDATE promo_signups SET delivery_status = 'sent', email_sent_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE promotion_request_id = ?1 AND delivery_status = 'sending'"
    : "UPDATE promo_signups SET delivery_status = 'failed' WHERE promotion_request_id = ?1 AND delivery_status = 'sending'",
  ).bind(requestId).run();
  return result.ok && saved.success && saved.meta.changes === 1;
}
