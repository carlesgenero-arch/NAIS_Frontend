import type { EmailMessage } from '../email/email.types.ts';
import type { NotificationSnapshot } from './order-notification.repository.ts';

function escape(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}
export function notificationMessage(order: NotificationSnapshot, recipient: string): EmailMessage {
  const items: unknown = JSON.parse(order.itemsJson);
  if (!Array.isArray(items) || !items.length) throw new Error('Invalid snapshot');
  const lines = items.map((item: unknown) => {
    if (!item || typeof item !== 'object' || !('name' in item) || typeof item.name !== 'string'
      || !('quantity' in item) || typeof item.quantity !== 'number'
      || !Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new Error('Invalid snapshot');
    return `${item.quantity} × ${item.name}`;
  });
  const money = (amount: number): string => {
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Invalid snapshot');
    return new Intl.NumberFormat('ca-ES', { style: 'currency', currency: order.currency }).format(amount / 100);
  };
  const sections = [
    'NAIS — Nova comanda pagada', `Comanda: ${order.order_number}`,
    `Client: ${order.customer_name || 'No indicat'}\nEmail: ${order.customer_email || 'No indicat'}`,
    `Productes\n${lines.join('\n')}`,
    [`Subtotal: ${money(order.subtotal_amount)}`, `Descompte: ${money(order.discount_amount)}`,
      `Enviament: ${money(order.shipping_amount)}`, `Impostos: ${money(order.tax_amount)}`,
      `Total: ${money(order.total_amount)}`].join('\n'),
    ['Adreça d’enviament', order.shipping_name, order.shipping_address_line1,
      order.shipping_address_line2, `${order.shipping_postal_code} ${order.shipping_city}`, order.shipping_country]
      .filter(Boolean).join('\n'),
    `Pagament: ${order.payment_status}\nPreparació: ${order.fulfillment_status}`,
  ];
  return { to: recipient, subject: 'NAIS — Nova comanda pagada', text: sections.join('\n\n'),
    html: `<html lang="ca"><body style="font-family:Arial,Helvetica,sans-serif;color:#18181A;background:#fff;">${sections.map((section, index) => index === 0
      ? `<h1 style="font-size:22px;">${escape(section)}</h1>`
      : `<p style="line-height:1.5;overflow-wrap:anywhere;">${escape(section).replace(/\n/g, '<br>')}</p>`).join('')}</body></html>` };
}
