import type { EmailMessage } from '../email/email.types.ts';
import type { ConfirmationSnapshot } from './order-confirmation.repository.ts';

function escape(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}
export function confirmationMessage(order: ConfirmationSnapshot): EmailMessage {
  const items: unknown = JSON.parse(order.itemsJson);
  if (!Array.isArray(items) || !items.length) throw new Error('Invalid snapshot');
  const money = (amount: number): string => {
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Invalid snapshot');
    return new Intl.NumberFormat('ca-ES', { style: 'currency', currency: order.currency }).format(amount / 100);
  };
  const lines = items.map((item: unknown) => {
    if (!item || typeof item !== 'object' || !('name' in item) || typeof item.name !== 'string'
      || !('quantity' in item) || typeof item.quantity !== 'number' || !Number.isSafeInteger(item.quantity) || item.quantity < 1
      || !('unit' in item) || typeof item.unit !== 'number' || !('total' in item) || typeof item.total !== 'number') throw new Error('Invalid snapshot');
    return { name: item.name, quantity: item.quantity, unit: money(item.unit), total: money(item.total) };
  });
  const greeting = order.customer_name ? `Hola, ${order.customer_name}!` : 'Hola!';
  const confirmation = 'Gràcies per la teva compra. Hem rebut el pagament de la teva comanda.';
  const nextStep = 'Et contactarem quan haguem enviat la comanda';
  const totals = [
    ['Subtotal', money(order.subtotal_amount)], ['Enviament', money(order.shipping_amount)],
    ['Descompte', money(order.discount_amount)], ['Impostos', money(order.tax_amount)],
  ];
  const total = `${money(order.total_amount)} (${order.currency.toUpperCase()})`;
  const address = [order.shipping_name, order.shipping_address_line1,
    order.shipping_address_line2 ?? '', `${order.shipping_postal_code} ${order.shipping_city}`, order.shipping_country,
  ].filter(Boolean);
  const paragraphs = ['NAIS — Confirmació de comanda', `Comanda: ${order.order_number}`, greeting, confirmation,
    'PRODUCTES', lines.map(item => `${item.name}\nQuantitat: ${item.quantity} × ${item.unit}\nImport: ${item.total}`).join('\n\n'),
    'RESUM', totals.map(([label, amount]) => `${label}: ${amount}`).join('\n'), `Total pagat: ${total}`,
    'ADREÇA D’ENVIAMENT', address.join('\n'), nextStep,
    'NAIS Drinks\nTens cap dubte? Escriu-nos a info@naisdrinks.com'];
  // Inline styles and presentation tables are deliberate for email clients.
  // Brand colours mirror the storefront; no remote fonts, CSS or images required.
  return { to: order.customer_email, subject: 'NAIS — Confirmació de comanda',
    text: paragraphs.join('\n\n'),
    html: `<!doctype html>
<html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>NAIS — Confirmació de comanda</title></head>
<body style="margin:0;padding:0;background-color:#ECE3D8;color:#18181A;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#ECE3D8;"><tr><td align="center" style="padding:16px 8px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;table-layout:fixed;background-color:#FFFFFF;">
<tr><td style="padding:28px 20px;background-color:#F6D03E;">
  <p style="margin:0 0 20px;font-size:32px;line-height:1.1;font-weight:bold;letter-spacing:2px;">NAIS</p>
  <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;">Gràcies per la teva comanda!</h1>
  <p style="margin:0;font-size:18px;line-height:1.5;word-wrap:break-word;overflow-wrap:anywhere;"><strong>Comanda: ${escape(order.order_number)}</strong></p>
</td></tr>
<tr><td style="padding:28px 20px 12px;font-size:16px;line-height:1.6;word-wrap:break-word;overflow-wrap:anywhere;">
  <p style="margin:0 0 12px;">${escape(greeting)}</p><p style="margin:0;">${escape(confirmation)}</p>
</td></tr>
<tr><td style="padding:16px 20px;">
  <h2 style="margin:0 0 8px;font-size:20px;line-height:1.4;">Els teus productes</h2>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;">
    ${lines.map(item => `<tr><td style="padding:16px 0;border-bottom:1px solid #ECE3D8;word-wrap:break-word;overflow-wrap:anywhere;">
      <h3 style="margin:0 0 6px;font-size:16px;line-height:1.5;">${escape(item.name)}</h3>
      <p style="margin:0 0 4px;font-size:14px;line-height:1.5;">Quantitat: ${item.quantity} × ${escape(item.unit)}</p>
      <p style="margin:0;font-size:16px;line-height:1.5;"><strong>Import: ${escape(item.total)}</strong></p>
    </td></tr>`).join('')}
  </table>
</td></tr>
<tr><td style="padding:8px 20px 24px;">
  <h2 style="margin:0 0 12px;font-size:20px;line-height:1.4;">Resum de la comanda</h2>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" aria-label="Imports de la comanda" style="width:100%;table-layout:fixed;font-size:15px;line-height:1.5;">
    ${totals.map(([label, amount]) => `<tr><th scope="row" align="left" style="padding:6px 8px 6px 0;font-weight:normal;">${escape(label)}</th><td align="right" style="padding:6px 0;word-wrap:break-word;">${escape(amount)}</td></tr>`).join('')}
  </table>
  <p style="margin:16px 0 0;padding:20px 16px;background-color:#18181A;color:#FFFFFF;font-size:22px;line-height:1.5;word-wrap:break-word;overflow-wrap:anywhere;">Total pagat<br><strong>${escape(total)}</strong></p>
</td></tr>
<tr><td style="padding:0 20px 28px;font-size:16px;line-height:1.6;word-wrap:break-word;overflow-wrap:anywhere;">
  <h2 style="margin:0 0 12px;font-size:20px;line-height:1.4;">Adreça d’enviament</h2>
  <p style="margin:0 0 20px;">${address.map(escape).join('<br>')}</p>
  <p style="margin:0;">${escape(nextStep)}</p>
</td></tr>
<tr><td style="padding:24px 20px;border-top:1px solid #ECE3D8;font-size:14px;line-height:1.6;word-wrap:break-word;overflow-wrap:anywhere;">
  <p style="margin:0 0 8px;"><strong>NAIS Drinks</strong></p>
  <p style="margin:0;">Tens cap dubte?<br><a href="mailto:info@naisdrinks.com" style="color:#18181A;text-decoration:underline;">info@naisdrinks.com</a></p>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>` };
}
