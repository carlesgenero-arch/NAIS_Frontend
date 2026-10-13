import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { confirmationMessage } from '../server/orders/order-confirmation.template.ts';

// Development fixture only: no credentials, services or real customer data.
/** @type {import('../server/orders/order-confirmation.repository.ts').ConfirmationSnapshot} */
const sampleOrder = {
  order_number: 'NAIS-DEMO-2026-0042',
  customer_name: 'Laia Exemple',
  customer_email: 'laia@example.com',
  shipping_name: 'Laia Exemple',
  shipping_address_line1: 'Carrer de la Mostra, 12',
  shipping_address_line2: '2n pis, porta 1',
  shipping_postal_code: '08001',
  shipping_city: 'Barcelona',
  shipping_country: 'ES',
  currency: 'eur',
  subtotal_amount: 14400,
  shipping_amount: 0,
  discount_amount: 1440,
  tax_amount: 0,
  total_amount: 12960,
  itemsJson: JSON.stringify([
    { name: 'Orange Spritz — Pack 16', quantity: 2, unit: 3600, total: 7200 },
    { name: 'Passion Hugo — Pack 16', quantity: 1, unit: 3600, total: 3600 },
    { name: 'Ginger Crush — Pack 16', quantity: 1, unit: 3600, total: 3600 },
  ]),
};

// Resolve from this script, so output never depends on the caller's directory.
const output = new URL('../tmp/order-confirmation-preview.html', import.meta.url);
await mkdir(new URL('../tmp/', import.meta.url), { recursive: true });
await writeFile(output, confirmationMessage(sampleOrder).html, 'utf8');
console.log(`Email preview (no email sent): ${fileURLToPath(output)}`);
