import { sendEmail } from '../email/email.service.ts';
import type { EmailEnvironment, EmailMessage } from '../email/email.types.ts';
import type { PromoDatabase } from './promo-signup.ts';

function escape(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

/** Match checkout's safe origin rules; never invent a production URL for another environment. */
function homeUrl(siteUrl?: string): string | null {
  if (typeof siteUrl !== 'string' || !siteUrl.trim()) return null;
  try {
    const site = new URL(siteUrl);
    const local = site.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(site.hostname);
    if ((!local && site.protocol !== 'https:') || site.username || site.password
      || site.pathname !== '/' || site.search || site.hash) return null;
    return new URL('/home', site.origin).href;
  } catch { return null; }
}

export function promoMessage(email: string, code: string, siteUrl?: string): EmailMessage {
  const home = homeUrl(siteUrl);
  const lines = ['NAIS — Un 10% per a la teva primera comanda',
    'Gràcies per descobrir NAIS! Utilitza aquest codi al pagament per obtenir un 10% de descompte:',
    code, 'Codi d’un sol ús, vàlid per a la primera comanda.'];
  const footer = 'NAIS Drinks\nTens cap dubte? Escriu-nos a info@naisdrinks.com';
  // Inline styles, system fonts and presentation tables mirror the order confirmation.
  return { to: email, subject: 'NAIS — El teu codi del 10%',
    text: [...lines, ...(home ? [`DESCOBREIX NAIS\n${home}`] : []), footer].join('\n\n'),
    html: `<!doctype html>
<html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>NAIS — El teu codi del 10%</title></head>
<body style="margin:0;padding:0;background-color:#ECE3D8;color:#18181A;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#ECE3D8;"><tr><td align="center" style="padding:16px 8px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;table-layout:fixed;background-color:#FFFFFF;">
<tr><td style="padding:28px 20px;background-color:#F6D03E;">
  <p style="margin:0 0 20px;font-size:32px;line-height:1.1;font-weight:bold;letter-spacing:2px;">NAIS</p>
  <h1 style="margin:0;font-size:26px;line-height:1.25;">Un 10% per a la teva primera comanda</h1>
</td></tr>
<tr><td style="padding:28px 20px 12px;font-size:16px;line-height:1.6;word-wrap:break-word;overflow-wrap:anywhere;">
  <p style="margin:0;">${escape(lines[1])}</p>
</td></tr>
<tr><td style="padding:16px 20px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;background-color:#18181A;color:#FFFFFF;"><tr><td align="center" style="padding:24px 16px;word-wrap:break-word;overflow-wrap:anywhere;">
    <p style="margin:0 0 10px;font-size:14px;line-height:1.5;letter-spacing:1px;">EL TEU CODI DEL 10%</p>
    <p id="promo-code" style="margin:0;font-size:30px;line-height:1.4;font-weight:bold;letter-spacing:1px;word-wrap:break-word;overflow-wrap:anywhere;">${escape(code)}</p>
  </td></tr></table>
</td></tr>
<tr><td style="padding:0 20px 24px;font-size:14px;line-height:1.6;word-wrap:break-word;overflow-wrap:anywhere;">
  <p style="margin:0;">${escape(lines[3])}</p>
</td></tr>
${home ? `<tr><td align="center" style="padding:0 20px 28px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#F6D03E" style="background-color:#F6D03E;border:1px solid #18181A;mso-padding-alt:14px 22px;">
    <a href="${escape(home)}" style="display:inline-block;padding:14px 22px;color:#18181A;font-size:14px;line-height:20px;font-weight:bold;letter-spacing:1px;text-align:center;text-decoration:none;">DESCOBREIX NAIS</a>
  </td></tr></table>
</td></tr>` : ''}
<tr><td style="padding:24px 20px;border-top:1px solid #ECE3D8;font-size:14px;line-height:1.6;word-wrap:break-word;overflow-wrap:anywhere;">
  <p style="margin:0 0 8px;"><strong>NAIS Drinks</strong></p>
  <p style="margin:0;">Tens cap dubte?<br><a href="mailto:info@naisdrinks.com" style="color:#18181A;text-decoration:underline;">info@naisdrinks.com</a></p>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>` };
}

/** Only the atomic claim winner sends. Failed/ambiguous attempts need controlled
 * reconciliation; repeating a signup must never resend or generate another code. */
export async function deliverPromo(db: PromoDatabase, requestId: string, env: EmailEnvironment & { SITE_URL?: string }): Promise<boolean> {
  const claimed = await db.prepare(
    "UPDATE promo_signups SET delivery_status = 'sending' WHERE promotion_request_id = ?1 AND delivery_status = 'pending' AND stripe_promotion_code_id IS NOT NULL AND promotion_code IS NOT NULL",
  ).bind(requestId).run();
  if (!claimed.success || claimed.meta.changes !== 1) return false;
  const row = await db.prepare(
    'SELECT email, promotion_code FROM promo_signups WHERE promotion_request_id = ?1',
  ).bind(requestId).first<{ email: string; promotion_code: string }>();
  if (!row) return false;
  const result = await sendEmail(promoMessage(row.email, row.promotion_code, env.SITE_URL), env);
  const saved = await db.prepare(result.ok
    ? "UPDATE promo_signups SET delivery_status = 'sent', email_sent_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE promotion_request_id = ?1 AND delivery_status = 'sending'"
    : "UPDATE promo_signups SET delivery_status = 'failed' WHERE promotion_request_id = ?1 AND delivery_status = 'sending'",
  ).bind(requestId).run();
  return result.ok && saved.success && saved.meta.changes === 1;
}
