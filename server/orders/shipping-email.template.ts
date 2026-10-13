import type { AdminOrder } from './admin-order.types.ts';
import type { EmailMessage } from '../email/email.types.ts';

function escape(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}
export function shippingMessage(order: AdminOrder): EmailMessage {
  const address = order.shippingAddress;
  const lines = ['NAIS — Comanda enviada', order.customer.name ? `Hola, ${order.customer.name}!` : 'Hola!',
    'La teva comanda s’ha enviat. Gràcies per confiar en NAIS!', `Comanda: ${order.orderNumber}`,
    ...order.items.map(item => `${item.productName} — Quantitat: ${item.quantity}`),
    'Adreça d’enviament:', address.name, address.line1, address.line2 ?? '',
    `${address.postalCode} ${address.city}`, address.country].filter(Boolean);
  return { to: order.customer.email, subject: 'NAIS — La teva comanda s’ha enviat',
    text: lines.join('\n\n'), html: `<main lang="ca"><h1>${escape(lines[0])}</h1>${lines.slice(1).map(line => `<p>${escape(line)}</p>`).join('')}</main>` };
}
