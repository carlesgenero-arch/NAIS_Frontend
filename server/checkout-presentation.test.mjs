import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkoutDb } from './testing/checkout-db.mjs';
import { stripeCatalogue } from './testing/stripe-catalogue.mjs';
import { normalizeCheckoutPresentation } from './stripe/normalize-checkout-presentation.mjs';
import { updateAdminProduct } from './catalogue/product-write.service.ts';

test('all active products get the same pack description; prices, D1 and existing images stay unchanged', async t => {
  const { sqlite } = checkoutDb(t);
  const stripe = stripeCatalogue();
  const rows = sqlite.prepare(`SELECT id,name,status,stripe_product_id AS stripeProductId,
    stripe_price_id AS stripePriceId,price_cents AS priceCents,currency FROM products`).all();
  const before = sqlite.prepare('SELECT * FROM products').all();
  const oldPrices = structuredClone([...stripe.prices]);
  for (const product of stripe.products.values()) {
    product.description = 'Long marketing copy';
    product.images = product.id.includes('ginger') ? ['https://nais.example/ginger.png'] : [];
  }
  const images = [...stripe.products].map(([id,p]) => [id, [...p.images]]);
  const count = await normalizeCheckoutPresentation(rows, stripe.client);
  assert.equal(count, rows.filter(p => p.status === 'active').length);
  for (const row of rows.filter(p => p.status === 'active')) {
    const product = stripe.products.get(stripe.prices.get(row.stripePriceId).product);
    assert.equal(product.description, 'Pack 16');
    assert.equal(product.name, row.name);
  }
  assert.deepEqual([...stripe.prices], oldPrices);
  assert.deepEqual([...stripe.products].map(([id,p]) => [id,p.images]), images);
  assert.deepEqual(sqlite.prepare('SELECT * FROM products').all(), before);
  await normalizeCheckoutPresentation(rows, stripe.client);
  assert.equal(stripe.calls.some(c => c[0] === 'price.create' || c[0] === 'product.create'), false);
});

test('subsequent admin marketing edits cannot restore long checkout descriptions or replace images', async t => {
  const { db } = checkoutDb(t); const stripe = stripeCatalogue();
  stripe.products.get('prod_gingercrush').images = ['https://nais.example/ginger.png'];
  await updateAdminProduct(db, 'ginger-crush', { description: 'Long storefront marketing copy' }, () => stripe.client);
  assert.equal(stripe.products.get('prod_gingercrush').description, 'Pack 16');
  assert.deepEqual(stripe.products.get('prod_gingercrush').images, ['https://nais.example/ginger.png']);
});

test('missing or mismatched price mapping fails before any Product writes', async () => {
  for (const priceCents of [1, 3600]) {
    const stripe = stripeCatalogue();
    const rows = [{ id: 'orange-spritz', name: 'Orange', status: 'active',
      stripePriceId: priceCents === 1 ? 'price_orangeFixture' : 'price_missing', priceCents, currency: 'eur' }];
    await assert.rejects(normalizeCheckoutPresentation(rows, stripe.client));
    assert.equal(stripe.calls.length, 0);
  }
});
