import { findProductBySlug, findProductsByStatus, findCheckoutProductsByIds, type ProductDatabase } from './product.repository.ts';
import type { CatalogueProduct, PublicCatalogueProduct, PurchasableProduct } from './product.types.ts';

export function isProductSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 200 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function nullableText(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function readProduct(value: unknown): CatalogueProduct {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid catalogue data');
  const row = value as Record<string, unknown>;
  const status = row['status'];
  if (!isProductSlug(row['id']) || !isProductSlug(row['slug'])
    || typeof row['name'] !== 'string' || !row['name'].trim()
    || !nullableText(row['description']) || !nullableText(row['imageUrl']) || !nullableText(row['featureImageUrl'])
    || (status !== 'active' && status !== 'coming-soon' && status !== 'draft' && status !== 'archived')
    || typeof row['priceCents'] !== 'number' || !Number.isSafeInteger(row['priceCents']) || row['priceCents'] < 0
    || typeof row['currency'] !== 'string' || !/^[a-z]{3}$/.test(row['currency'])) {
    throw new Error('Invalid catalogue data');
  }
  // Explicit projection prevents accidental exposure of private columns.
  return {
    id: row['id'], slug: row['slug'], name: row['name'], description: row['description'], status,
    priceCents: row['priceCents'], currency: row['currency'],
    imageUrl: row['imageUrl'], featureImageUrl: row['featureImageUrl'],
  };
}

function isPublic(product: CatalogueProduct): product is PublicCatalogueProduct {
  return product.status === 'active';
}

/** Coming-soon, draft and archived products are not public or purchasable. */
export async function listActiveProducts(db: ProductDatabase): Promise<readonly PublicCatalogueProduct[]> {
  try {
    return (await findProductsByStatus(db, 'active')).map(readProduct).filter(isPublic);
  } catch {
    throw new Error('Catalogue unavailable');
  }
}

export async function getPublicProductBySlug(db: ProductDatabase, slug: string): Promise<PublicCatalogueProduct | null> {
  if (!isProductSlug(slug)) throw new Error('Invalid product slug');
  try {
    const row = await findProductBySlug(db, slug);
    if (row === null) return null;
    const product = readProduct(row);
    return isPublic(product) ? product : null;
  } catch {
    throw new Error('Catalogue unavailable');
  }
}

export class UnavailableCheckoutProductError extends Error {
  constructor() { super('Product unavailable'); }
}

/** The D1 status is authoritative; no fallback to the legacy checkout allowlist. */
export async function getPurchasableProducts(db: ProductDatabase, ids: readonly string[]): Promise<readonly PurchasableProduct[]> {
  const rows = await findCheckoutProductsByIds(db, ids);
  const products = new Map<string, PurchasableProduct>();
  for (const value of rows) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid checkout configuration');
    const row = value as Record<string, unknown>;
    if (!isProductSlug(row['id']) || !ids.includes(row['id']) || products.has(row['id'])) throw new Error('Invalid checkout configuration');
    if (row['status'] === 'coming-soon' || row['status'] === 'draft' || row['status'] === 'archived') {
      throw new UnavailableCheckoutProductError();
    }
    if (row['status'] !== 'active' || typeof row['stripePriceId'] !== 'string'
      || !/^price_[a-zA-Z0-9]{1,200}$/.test(row['stripePriceId'])
      || typeof row['priceCents'] !== 'number' || !Number.isSafeInteger(row['priceCents']) || row['priceCents'] < 0
      || row['currency'] !== 'eur') throw new Error('Invalid checkout configuration');
    products.set(row['id'], { id: row['id'], status: 'active', stripePriceId: row['stripePriceId'],
      priceCents: row['priceCents'], currency: row['currency'] });
  }
  return ids.map(id => {
    const product = products.get(id);
    if (!product) throw new UnavailableCheckoutProductError();
    return product;
  });
}
