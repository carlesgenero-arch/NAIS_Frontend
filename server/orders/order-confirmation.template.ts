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
    return `${item.name} — ${item.quantity} × ${money(item.unit)} — ${money(item.total)}`;
  });
  const paragraphs = [
    'NAIS — Confirmació de comanda',
    order.customer_name ? `Hola, ${order.customer_name}!` : 'Hola!',
    'Gràcies per la teva compra. Hem rebut el pagament de la teva comanda.',
    `Comanda: ${order.order_number}`, ...lines,
    `Subtotal: ${money(order.subtotal_amount)}`, `Enviament: ${money(order.shipping_amount)}`,
    `Descompte: ${money(order.discount_amount)}`, `Impostos: ${money(order.tax_amount)}`,
    `Total pagat: ${money(order.total_amount)} (${order.currency.toUpperCase()})`,
    'Adreça d’enviament:', order.shipping_name, order.shipping_address_line1,
    order.shipping_address_line2 ?? '', `${order.shipping_postal_code} ${order.shipping_city}`, order.shipping_country,
  ].filter(Boolean);
  return { to: order.customer_email, subject: 'NAIS — Confirmació de comanda',
    text: paragraphs.join('\n\n'),
    html: `<main lang="ca"><h1>${escape(paragraphs[0])}</h1>${paragraphs.slice(1).map(line => `<p>${escape(line)}</p>`).join('')}</main>` };
}
