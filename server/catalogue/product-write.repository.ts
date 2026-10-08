import type { ProductDatabase } from './product.repository.ts';
import type { AdminProduct, CatalogueProduct } from './product.types.ts';
export type ManagedProduct = Omit<CatalogueProduct, 'id'>;
export class ProductSlugConflict extends Error {}
const columns = 'slug, name, description, status, price_cents, currency, image_url, feature_image_url';
const assignments = 'slug=?, name=?, description=?, status=?, price_cents=?, currency=?, image_url=?, feature_image_url=?';
const values = (p: ManagedProduct) => [p.slug, p.name, p.description, p.status, p.priceCents, p.currency, p.imageUrl, p.featureImageUrl];
function slugConflict(error: unknown): boolean {
  // D1 may wrap SQLite's constraint error; never expose its message to the client.
  return error instanceof Error && (/UNIQUE constraint failed: products\.slug\b/.test(error.message)
    || (error.cause !== error && error.cause instanceof Error && /UNIQUE constraint failed: products\.slug\b/.test(error.cause.message)));
}
export async function insertProduct(db: ProductDatabase, id: string, product: ManagedProduct): Promise<boolean> {
  const row = await db.prepare(`INSERT INTO products (id, ${columns}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO NOTHING RETURNING id`).bind(id, ...values(product)).first<{ id: string }>();
  return row !== null;
}
export async function updateProduct(db: ProductDatabase, previous: AdminProduct, product: ManagedProduct): Promise<boolean> {
  try {
    // Compare the full previous snapshot to avoid overwriting concurrent edits or Stripe configuration.
    const row = await db.prepare(`UPDATE products SET ${assignments},
      updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id=? AND slug IS ? AND name IS ? AND description IS ? AND status IS ? AND price_cents IS ?
      AND currency IS ? AND image_url IS ? AND feature_image_url IS ?
      AND stripe_product_id IS ? AND stripe_price_id IS ? AND updated_at IS ? RETURNING id`)
      .bind(...values(product), previous.id, ...values(previous), previous.stripeProductId, previous.stripePriceId, previous.updatedAt)
      .first<{ id: string }>();
    return row !== null;
  } catch (error) {
    if (slugConflict(error)) throw new ProductSlugConflict();
    throw error;
  }
}
export async function archiveProduct(db: ProductDatabase, id: string): Promise<boolean> {
  const row = await db.prepare(`UPDATE products SET status='archived',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? RETURNING id`).bind(id).first<{ id: string }>();
  return row !== null;
}
