import type Stripe from 'stripe';
import type { AdminProduct } from '../catalogue/product.types.ts';
import type { ManagedProduct } from '../catalogue/product-write.repository.ts';

type Price = Pick<Stripe.Price, 'id' | 'active' | 'type' | 'billing_scheme' | 'unit_amount' | 'currency' | 'product'>;
type Product = Pick<Stripe.Product, 'id' | 'active' | 'metadata'>;
export interface StripeCatalogueClient {
  products: {
    retrieve(id: string): Promise<Product | Stripe.DeletedProduct>;
    create(params: Stripe.ProductCreateParams, options?: Stripe.RequestOptions): Promise<Product>;
    update(id: string, params: Stripe.ProductUpdateParams, options?: Stripe.RequestOptions): Promise<Product>;
  };
  prices: {
    retrieve(id: string): Promise<Price>;
    list(params: Stripe.PriceListParams): Promise<{ data: Price[] }>;
    create(params: Stripe.PriceCreateParams, options?: Stripe.RequestOptions): Promise<Price>;
    update(id: string, params: Stripe.PriceUpdateParams): Promise<Price>;
  };
}
export interface StripeMapping { stripeProductId: string; stripePriceId: string }

async function hash(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
function missing(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && error.code === 'resource_missing';
}
function productId(price: Price): string {
  return typeof price.product === 'string' ? price.product : price.product.id;
}
function verify(price: Price, product: ManagedProduct, id: string): void {
  if (!price.id.startsWith('price_') || !price.active || price.type !== 'one_time'
    || price.billing_scheme !== 'per_unit' || price.unit_amount !== product.priceCents
    || price.currency !== 'eur' || productId(price) !== id) throw new Error('Invalid Stripe catalogue price');
}

/** Prepare Stripe objects without changing the operational D1 catalogue. */
export async function synchronizeStripeCatalogue(client: StripeCatalogueClient, previous: AdminProduct,
  product: ManagedProduct): Promise<StripeMapping> {
  if (product.currency !== 'eur' || !Number.isSafeInteger(product.priceCents) || product.priceCents <= 0) {
    throw new Error('Invalid purchasable product');
  }
  const oldPrice = previous.stripePriceId ? await client.prices.retrieve(previous.stripePriceId) : null;
  // Legacy D1 records can have a Price but no Product ID. Recover the existing Product from Stripe.
  const existingId = previous.stripeProductId ?? (oldPrice ? productId(oldPrice) : null);
  const id = existingId ?? 'nais_' + await hash(previous.id);
  let stripeProduct: Product | Stripe.DeletedProduct;
  try { stripeProduct = await client.products.retrieve(id); }
  catch (error) {
    if (existingId || !missing(error)) throw error;
    // A permanent, server-generated Product ID also prevents duplicates after Stripe's idempotency TTL.
    stripeProduct = await client.products.create({ id, name: previous.id, metadata: { nais_product_id: previous.id } },
      { idempotencyKey: 'nais-product-' + await hash(previous.id) });
  }
  if ('deleted' in stripeProduct || !stripeProduct.active || stripeProduct.id !== id
    || (stripeProduct.metadata['nais_product_id'] && stripeProduct.metadata['nais_product_id'] !== previous.id)) {
    throw new Error('Invalid Stripe catalogue product');
  }
  if (oldPrice && productId(oldPrice) !== id) throw new Error('Stripe mapping mismatch');
  await client.products.update(id, { name: product.name, description: product.description ?? '',
    metadata: { nais_product_id: previous.id } });

  if (oldPrice && oldPrice.unit_amount === product.priceCents && oldPrice.currency === product.currency && oldPrice.active) {
    verify(oldPrice, product, id);
    return { stripeProductId: id, stripePriceId: oldPrice.id };
  }
  // Unique lookup keys recover a previously created Price even if the D1 write failed.
  // Include the prior revision so returning to an old amount never reuses an archived Price.
  const key = 'nais-price-' + await hash([previous.id, previous.updatedAt, previous.stripePriceId, id, product.priceCents, product.currency]);
  const found = await client.prices.list({ lookup_keys: [key], limit: 1 });
  const candidate = found.data[0] ?? await client.prices.create({ product: id, currency: 'eur',
    unit_amount: product.priceCents, billing_scheme: 'per_unit', lookup_key: key,
    metadata: { nais_product_id: previous.id } }, { idempotencyKey: key });
  // Verify through a retrieve, rather than trusting a create response alone.
  const price = await client.prices.retrieve(candidate.id);
  if (price.id !== candidate.id) throw new Error('Invalid Stripe price response');
  verify(price, product, id);
  return { stripeProductId: id, stripePriceId: price.id };
}
