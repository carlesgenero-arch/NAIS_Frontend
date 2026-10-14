import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkoutDb } from './testing/checkout-db.mjs';
import { listAdminProducts } from './catalogue/product.service.ts';
import { onRequest as list } from '../functions/api/products/index.ts';
import { onRequest as detail } from '../functions/api/products/[slug].ts';
import { validateCheckout } from './checkout/checkout-validation.ts';

const migration = readFileSync(new URL('../migrations/0009_hide_tropical_hops.sql', import.meta.url), 'utf8');

test('visibility migration preserves data, Stripe mappings, Harvest and all other products', t => {
  const { sqlite } = checkoutDb(t);
  const before = sqlite.prepare('SELECT * FROM products ORDER BY id').all();
  sqlite.exec(migration);
  const after = sqlite.prepare('SELECT * FROM products ORDER BY id').all();
  assert.equal(after.length, before.length);
  for (const [index, row] of after.entries()) {
    assert.deepEqual({ ...row }, row.id === 'tropical-hops'
      ? { ...before[index], status: 'coming-soon', updated_at: row.updated_at }
      : { ...before[index] });
  }
  sqlite.exec(migration);
  assert.deepEqual(sqlite.prepare('SELECT * FROM products ORDER BY id').all(), after);
});

test('hidden Tropical Hops is absent publicly, retained in admin, and rejected by server checkout', async t => {
  const { sqlite, db } = checkoutDb(t);
  sqlite.exec(migration);
  const context = { env: { PROMO_DB: db }, params: { slug: 'tropical-hops' },
    request: new Request('https://naisdrinks.com/api/products') };
  const products = await (await list(context)).json();
  assert.deepEqual(products.map(p => p.id).sort(), ['ginger-crush', 'orange-spritz', 'pack-variat', 'passion-hugo']);
  assert.equal((await detail(context)).status, 404);
  assert.equal((await listAdminProducts(db)).find(p => p.id === 'tropical-hops').status, 'coming-soon');
  for (const productId of ['tropical-hops', 'tropical-hops-harvest']) {
    const response = await validateCheckout(new Request('https://naisdrinks.com/api/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId, quantity: 1 }] }),
    }), context.env);
    assert.ok(response instanceof Response);
    assert.equal(response.status, 400);
  }
});
