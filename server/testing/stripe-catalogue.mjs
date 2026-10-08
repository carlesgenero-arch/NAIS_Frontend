import { priceIds, stripePrice } from './checkout-db.mjs';

/** In-memory Stripe double: unique Product IDs/Price lookup keys, no network calls. */
export function stripeCatalogue() {
  const products = new Map(); const prices = new Map(); const lookups = new Map(); const calls = [];
  for (const [id, price] of Object.entries(priceIds)) {
    const product = 'prod_' + id.replaceAll('-', '');
    products.set(product, { id: product, active: true, metadata: {} });
    prices.set(price, { ...stripePrice(price), product });
  }
  const client = {
    products: {
      async retrieve(id) { if (!products.has(id)) throw Object.assign(new Error('Missing'), { code: 'resource_missing' }); return { ...products.get(id) }; },
      async create(params, options) {
        calls.push(['product.create', params, options]);
        if (products.has(params.id)) throw new Error('Product already exists');
        const product = { ...params, active: true }; products.set(params.id, product); return product;
      },
      async update(id, params) { calls.push(['product.update', id, params]); const p = { ...products.get(id), ...params }; products.set(id, p); return p; },
    },
    prices: {
      async retrieve(id) { if (!prices.has(id)) throw new Error('Missing price'); return { ...prices.get(id) }; },
      async list(params) { return { data: params.lookup_keys.flatMap(key => lookups.has(key) ? [prices.get(lookups.get(key))] : []) }; },
      async create(params, options) {
        calls.push(['price.create', params, options]);
        if (lookups.has(params.lookup_key)) throw new Error('Lookup key already exists');
        const price = { ...stripePrice('price_new' + prices.size), ...params };
        prices.set(price.id, price); lookups.set(params.lookup_key, price.id); return price;
      },
      async update(id, params) { calls.push(['price.update', id, params]); const p = { ...prices.get(id), ...params }; prices.set(id, p); return p; },
    },
  };
  return { client, products, prices, calls };
}
