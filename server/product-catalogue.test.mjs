import { onRequest as list } from '../functions/api/products/index.ts';
import { onRequest as detail } from '../functions/api/products/[slug].ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { listActiveProducts, getPublicProductBySlug } from './catalogue/product.service.ts';

function setup(t) {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of ['0004_products.sql', '0005_seed_products.sql']) {
    sqlite.exec(readFileSync(new URL('../migrations/' + file, import.meta.url), 'utf8'));
  }
  t.after(() => sqlite.close());
  const db = { prepare(sql) {
    return { values: [], bind(...values) { this.values = values; return this; },
      async first() { return sqlite.prepare(sql).get(...this.values) ?? null; },
      async all() { return { success: true, results: sqlite.prepare(sql).all(...this.values) }; },
    };
  } };
  return { db, sqlite };
}

test('lists only the five active seeded products in deterministic slug order', async t => {
  const { db } = setup(t);
  const products = await listActiveProducts(db);
  assert.deepEqual(products.map(p => p.id), ['ginger-crush', 'orange-spritz', 'pack-variat', 'passion-hugo', 'tropical-hops']);
  assert.ok(products.every(p => p.status === 'active' && p.priceCents === 3600 && p.currency === 'eur'));
});

test('fetches by slug and returns only public fields, excluding Stripe IDs and timestamps', async t => {
  const { db, sqlite } = setup(t);
  sqlite.exec("UPDATE products SET stripe_price_id='price_private', stripe_product_id='prod_private'");
  const product = await getPublicProductBySlug(db, 'orange-spritz');
  assert.deepEqual(product, {
    id: 'orange-spritz', slug: 'orange-spritz', name: 'ORANGE SPRITZ',
    description: 'Cítrica amb un toc amarg i àcid. Caràcter i puresa a cada glop',
    status: 'active', priceCents: 3600, currency: 'eur',
    imageUrl: 'images/products/mocktails_3.png', featureImageUrl: null,
  });
});

test('coming-soon, draft and archived products are hidden for lists and direct lookup', async t => {
  const { db, sqlite } = setup(t);
  assert.equal(await getPublicProductBySlug(db, 'tropical-hops-harvest'), null);
  for (const status of ['draft', 'archived']) {
    sqlite.prepare('UPDATE products SET status=? WHERE id=?').run(status, 'orange-spritz');
    assert.equal(await getPublicProductBySlug(db, 'orange-spritz'), null);
    assert.equal((await listActiveProducts(db)).length, 4);
  }
});

test('unknown product returns null and an empty active catalogue returns an empty list', async t => {
  const { db, sqlite } = setup(t);
  assert.equal(await getPublicProductBySlug(db, 'unknown-product'), null);
  sqlite.exec("UPDATE products SET status='draft'");
  assert.deepEqual(await listActiveProducts(db), []);
});

test('invalid status data fails closed with a generic error', async t => {
  const { db, sqlite } = setup(t);
  sqlite.exec("PRAGMA ignore_check_constraints=ON; UPDATE products SET status='invalid' WHERE id='orange-spritz'");
  await assert.rejects(getPublicProductBySlug(db, 'orange-spritz'), { message: 'Catalogue unavailable' });
  assert.ok((await listActiveProducts(db)).every(p => p.id !== 'orange-spritz'));
});

test('malformed persisted prices fail closed', async t => {
  const { db, sqlite } = setup(t);
  sqlite.exec("PRAGMA ignore_check_constraints=ON; UPDATE products SET price_cents=1.5 WHERE id='orange-spritz'");
  await assert.rejects(listActiveProducts(db), { message: 'Catalogue unavailable' });
});

test('invalid slugs are rejected before querying D1', async () => {
  const db = { prepare() { assert.fail('Must not query D1'); } };
  for (const slug of ['', "' OR 1=1 --", '../products', 'A'.repeat(201), null]) {
    await assert.rejects(getPublicProductBySlug(db, slug), { message: 'Invalid product slug' });
  }
});

test('database failures expose no SQL or internal details', async () => {
  const db = { prepare() { throw new Error('Private database SQL'); } };
  await assert.rejects(listActiveProducts(db), { message: 'Catalogue unavailable' });
  await assert.rejects(getPublicProductBySlug(db, 'orange-spritz'), { message: 'Catalogue unavailable' });
});

test('unsuccessful D1 list result is not mistaken for an empty catalogue', async () => {
  const db = { prepare() { return { bind() { return this; }, async all() { return { success: false, results: [] }; } }; } };
  await assert.rejects(listActiveProducts(db), { message: 'Catalogue unavailable' });
});

function context(db, slug = 'orange-spritz', method = 'GET') {
  return { env: { PROMO_DB: db }, params: { slug }, request: new Request('https://naisdrinks.com/api/products', { method }) };
}

const publicKeys = ['id', 'slug', 'name', 'description', 'status', 'priceCents', 'currency', 'imageUrl', 'featureImageUrl'].sort();

test('public list API returns a JSON array with only public fields', async t => {
  const { db } = setup(t);
  const response = await list(context(db));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Content-Type'), /application\/json/);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const products = await response.json();
  assert.equal(products.length, 5);
  for (const product of products) assert.deepEqual(Object.keys(product).sort(), publicKeys);
});

test('public detail API returns one public product without internal identifiers', async t => {
  const { db, sqlite } = setup(t);
  sqlite.exec("UPDATE products SET stripe_price_id='price_private', stripe_product_id='prod_private'");
  const response = await detail(context(db));
  assert.equal(response.status, 200);
  const product = await response.json();
  assert.deepEqual(Object.keys(product).sort(), publicKeys);
  assert.equal(product.id, 'orange-spritz');
  assert.equal(product.priceCents, 3600);
});

test('unknown or non-public products return the same safe 404 and are absent from list', async t => {
  const { db, sqlite } = setup(t);
  sqlite.exec("UPDATE products SET status='draft' WHERE id='orange-spritz'; UPDATE products SET status='archived' WHERE id='ginger-crush'");
  for (const slug of ['unknown', 'orange-spritz', 'ginger-crush', 'tropical-hops-harvest']) {
    const response = await detail(context(db, slug));
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { status: 'not_found' });
  }
  const products = await (await list(context(db))).json();
  assert.equal(products.length, 3);
  assert.ok(products.every(p => p.status === 'active'));
});

test('missing and malformed slug parameters return 400 before accessing D1', async () => {
  const db = { prepare() { assert.fail('Invalid input must not query D1'); } };
  for (const slug of ['', null, [], ['orange-spritz'], "' OR 1=1 --", '../products', 'a'.repeat(201)]) {
    const response = await detail(context(db, slug));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { status: 'invalid_request' });
  }
  const missing = context(db);
  delete missing.params.slug;
  assert.equal((await detail(missing)).status, 400);
});

test('both APIs return generic 503 for D1 failure or missing binding', async () => {
  for (const db of [undefined, { prepare() { throw new Error('SQL and private details'); } }]) {
    for (const handler of [list, detail]) {
      const response = await handler(context(db));
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { status: 'unavailable' });
    }
  }
});

test('both APIs allow only GET without wildcard CORS', async () => {
  for (const handler of [list, detail]) {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']) {
      const response = await handler(context(undefined, 'orange-spritz', method));
      assert.equal(response.status, 405);
      assert.equal(response.headers.get('Allow'), 'GET');
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
    }
  }
});
