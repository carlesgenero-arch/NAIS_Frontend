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
export async function updateProduct(db: ProductDatabase, previous: AdminProduct, product: ManagedProduct,
  mapping: Pick<AdminProduct, 'stripeProductId' | 'stripePriceId'> = previous): Promise<AdminProduct | null> {
  try {
    // Compare the full previous snapshot to avoid overwriting concurrent edits or Stripe configuration.
    const row = await db.prepare(`UPDATE products SET ${assignments}, stripe_product_id=?, stripe_price_id=?,
      stripe_price_cleanup_ids=CASE WHEN stripe_price_id IS NOT NULL AND stripe_price_id IS NOT ?
        THEN json_insert(stripe_price_cleanup_ids, '$[#]', stripe_price_id) ELSE stripe_price_cleanup_ids END,
      updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id=? AND slug IS ? AND name IS ? AND description IS ? AND status IS ? AND price_cents IS ?
      AND currency IS ? AND image_url IS ? AND feature_image_url IS ?
      AND stripe_product_id IS ? AND stripe_price_id IS ? AND updated_at IS ? RETURNING updated_at AS updatedAt,
      json_array_length(stripe_price_cleanup_ids) AS cleanupCount`)
      .bind(...values(product), mapping.stripeProductId, mapping.stripePriceId, mapping.stripePriceId,
        previous.id, ...values(previous), previous.stripeProductId, previous.stripePriceId, previous.updatedAt)
      .first<{ updatedAt: string; cleanupCount: number }>();
    return row ? { ...previous, ...product, stripeProductId: mapping.stripeProductId, stripePriceId: mapping.stripePriceId,
      updatedAt: row.updatedAt, stripePriceCleanupPending: row.cleanupCount > 0 } : null;
  } catch (error) {
    if (slugConflict(error)) throw new ProductSlugConflict();
    throw error;
  }
}
export async function isPriceReferenced(db: ProductDatabase, priceId: string): Promise<boolean> {
  return await db.prepare('SELECT 1 AS found FROM products WHERE stripe_price_id=? LIMIT 1')
    .bind(priceId).first<{ found: number }>() !== null;
}
export async function archiveProduct(db: ProductDatabase, id: string): Promise<boolean> {
  const row = await db.prepare(`UPDATE products SET status='archived',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? RETURNING id`).bind(id).first<{ id: string }>();
  return row !== null;
}
export async function deleteUnusedProduct(db: ProductDatabase, id: string): Promise<boolean> {
  // Check eligibility inside the DELETE, not in a separate check-then-delete operation.
  const row = await db.prepare(`DELETE FROM products WHERE id=?1 AND status IN ('draft','archived')
    AND NOT EXISTS (SELECT 1 FROM order_items WHERE product_id=?1) RETURNING id`)
    .bind(id).first<{ id: string }>();
  return row !== null;
}
export async function productHasOrders(db: ProductDatabase, id: string): Promise<boolean> {
  return await db.prepare('SELECT 1 AS found FROM order_items WHERE product_id=?1 LIMIT 1')
    .bind(id).first<{ found: number }>() !== null;
}


export async function pendingStripePrices(db: ProductDatabase, id: string): Promise<string[]> {
  const row = await db.prepare('SELECT stripe_price_cleanup_ids AS ids FROM products WHERE id=?')
    .bind(id).first<{ ids: string }>();
  if (!row) return [];
  const ids: unknown = JSON.parse(row.ids);
  if (!Array.isArray(ids) || ids.some(value => typeof value !== 'string' || !/^price_[a-zA-Z0-9]{1,200}$/.test(value))) {
    throw new Error('Invalid cleanup state');
  }
  return [...new Set(ids as string[])];
}
export async function removePendingStripePrice(db: ProductDatabase, id: string, priceId: string): Promise<void> {
  // Filter the current array so concurrent price edits cannot lose newly appended entries.
  await db.prepare(`UPDATE products SET stripe_price_cleanup_ids=(
    SELECT json_group_array(value) FROM json_each(stripe_price_cleanup_ids) WHERE value<>?1
  ) WHERE id=?2 RETURNING id`).bind(priceId, id).first<{ id: string }>();
}
