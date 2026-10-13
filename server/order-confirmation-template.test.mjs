import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmationMessage } from './orders/order-confirmation.template.ts';

const order = {
  order_number: 'NAIS-TEST-42', customer_name: 'Client de prova', customer_email: 'customer@example.com',
  shipping_name: 'Destinatari de prova', shipping_address_line1: 'Carrer de prova 12', shipping_address_line2: '2n 1a',
  shipping_postal_code: '08001', shipping_city: 'Barcelona', shipping_country: 'ES',
  subtotal_amount: 10800, shipping_amount: 600, discount_amount: 1080, tax_amount: 0, total_amount: 10320, currency: 'eur',
  itemsJson: JSON.stringify([{ name: 'Orange Spritz històric', quantity: 2, unit: 3600, total: 7200 },
    { name: 'Ginger Crush històric', quantity: 1, unit: 3600, total: 3600 }]),
};
const money = amount => new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'eur' }).format(amount / 100);

test('confirmation preserves historical items, amounts and address in both formats', () => {
  const message = confirmationMessage(order);
  assert.equal(message.to, order.customer_email);
  assert.equal(message.subject, 'NAIS — Confirmació de comanda');
  for (const body of [message.html, message.text]) {
    for (const value of [order.order_number, order.customer_name, order.shipping_name, order.shipping_address_line1,
      order.shipping_address_line2, order.shipping_postal_code, order.shipping_city, order.shipping_country,
      'Orange Spritz històric', 'Ginger Crush històric', `2 × ${money(3600)}`, `1 × ${money(3600)}`,
      ...[7200,3600,10800,600,1080,0,10320].map(money), 'EUR', 'Subtotal', 'Enviament', 'Descompte', 'Impostos', 'Total pagat',
      'Et contactarem quan haguem enviat la comanda', 'NAIS Drinks', 'info@naisdrinks.com']) {
      assert.ok(body.includes(value), `Missing presentation value: ${value}`);
    }
    assert.ok(!body.includes('Et contactarem quan la comanda surti enviada'));
  }
});

test('every user-derived HTML field stays escaped; text stays readable', () => {
  const unsafe = `<img src=x onerror="alert('x')">&`;
  const snapshot = { ...order };
  for (const key of ['order_number','customer_name','shipping_name','shipping_address_line1','shipping_address_line2',
    'shipping_postal_code','shipping_city','shipping_country']) snapshot[key] = unsafe;
  snapshot.itemsJson = JSON.stringify([{ name: unsafe, quantity: 1, unit: 3600, total: 3600 }]);
  const message = confirmationMessage(snapshot);
  assert.ok(!message.html.includes(unsafe));
  assert.equal((message.html.match(/&lt;img src=x onerror=&quot;alert\(&#39;x&#39;\)&quot;&gt;&amp;/g) ?? []).length, 9);
  assert.ok(message.text.includes(unsafe));
  assert.doesNotMatch(message.html, /<img|<script/);
});

test('email is fluid, self-contained and has a readable heading/table hierarchy', () => {
  const { html, text } = confirmationMessage(order);
  assert.match(html, /max-width:600px/);
  assert.match(html, /width="100%"/);
  assert.match(html, /<html lang="ca">/);
  assert.match(html, /<h1 /);
  assert.match(html, /<h2 /);
  assert.match(html, /scope="row"/);
  assert.match(html, /mailto:info@naisdrinks.com/);
  assert.doesNotMatch(html, /<script|<link|<style|https?:\/\//);
  assert.match(text, /PRODUCTES\n\n/);
  assert.match(text, /RESUM\n\n/);
  assert.match(text, /ADREÇA D’ENVIAMENT\n\n/);
});

test('optional name/address line and nonzero historical taxes remain supported', () => {
  const message = confirmationMessage({ ...order, customer_name: '', shipping_address_line2: null, tax_amount: 213 });
  for (const body of [message.html, message.text]) {
    assert.ok(body.includes('Hola!'));
    assert.ok(body.includes(money(213)));
    assert.doesNotMatch(body, /undefined|null/);
  }
});

test('invalid snapshot amounts and items still fail closed', () => {
  for (const change of [{ subtotal_amount: -1 }, { total_amount: 1.5 }, { itemsJson: '[]' },
    { itemsJson: JSON.stringify([{ name: 'Test', quantity: 0, unit: 3600, total: 0 }]) }]) {
    assert.throws(() => confirmationMessage({ ...order, ...change }), /Invalid snapshot/);
  }
});
