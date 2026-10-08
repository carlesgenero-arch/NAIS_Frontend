import type { ProductStatus } from './product.types.ts';

interface ProductStatement {
  bind(...values: string[]): ProductStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ success: boolean; results: T[] }>;
}

/** Minimal D1 contract, compatible with the existing PROMO_DB binding. */
export interface ProductDatabase {
  prepare(sql: string): ProductStatement;
}

const PRODUCT_COLUMNS = `id, slug, name, description, status,
  price_cents AS priceCents, currency, image_url AS imageUrl,
  feature_image_url AS featureImageUrl`;

/** Rows stay untrusted until the service validates them. */
export async function findProductsByStatus(db: ProductDatabase, status: ProductStatus): Promise<unknown[]> {
  const result = await db.prepare(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE status = ?1 ORDER BY slug`)
    .bind(status).all<unknown>();
  if (!result.success || !Array.isArray(result.results)) throw new Error('Catalogue query failed');
  return result.results;
}

export async function findProductBySlug(db: ProductDatabase, slug: string): Promise<unknown | null> {
  return db.prepare(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE slug = ?1`)
    .bind(slug).first<unknown>();
}

/** Private checkout projection, never returned by the public catalogue API. */
export async function findCheckoutProductsByIds(db: ProductDatabase, ids: readonly string[]): Promise<unknown[]> {
  if (!ids.length) return [];
  const result = await db.prepare(`SELECT id, status, stripe_price_id AS stripePriceId,
    price_cents AS priceCents, currency FROM products WHERE id IN (${ids.map(() => '?').join(',')})`)
    .bind(...ids).all<unknown>();
  if (!result.success || !Array.isArray(result.results)) throw new Error('Catalogue query failed');
  return result.results;
}

/** Admin-only projection; public queries deliberately never select these columns. */
const ADMIN_PRODUCT_COLUMNS = `${PRODUCT_COLUMNS}, stripe_product_id AS stripeProductId,
  stripe_price_id AS stripePriceId, created_at AS createdAt, updated_at AS updatedAt`;
export async function findAdminProducts(db: ProductDatabase): Promise<unknown[]> {
  const result = await db.prepare(`SELECT ${ADMIN_PRODUCT_COLUMNS} FROM products ORDER BY slug`).all<unknown>();
  if (!result.success || !Array.isArray(result.results)) throw new Error('Catalogue query failed');
  return result.results;
}
export async function findAdminProductById(db: ProductDatabase, id: string): Promise<unknown | null> {
  return db.prepare(`SELECT ${ADMIN_PRODUCT_COLUMNS} FROM products WHERE id = ?1`).bind(id).first<unknown>();
}
