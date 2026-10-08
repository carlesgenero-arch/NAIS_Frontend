import { getAdminProduct, isProductSlug } from './product.service.ts';
import type { ProductDatabase } from './product.repository.ts';
import { insertProduct, updateProduct, archiveProduct, deleteUnusedProduct, productHasOrders, isPriceReferenced, ProductSlugConflict, type ManagedProduct } from './product-write.repository.ts';
import { synchronizeStripeCatalogue, type StripeCatalogueClient } from '../stripe/stripe-catalogue.ts';

export class ProductMutationError extends Error {
  readonly status: 400 | 404 | 409;
  readonly code: string;
  constructor(status: 400 | 404 | 409, code: string) { super(code); this.status = status; this.code = code; }
}
const invalid = () => new ProductMutationError(400, 'invalid_payload');
const fields = ['slug','name','description','status','priceCents','currency','imageUrl','featureImageUrl'];
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const row = value as Record<string, unknown>;
  if (!Object.keys(row).length || Object.keys(row).some(key => !fields.includes(key))) throw invalid();
  return row;
}
function image(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !value || value.length > 2048 || /[\s\\\\]/.test(value)) throw invalid();
  if (/^\/?images\//.test(value)) {
    if (value.split('/').some(part => part === '..' || part === '.') || value.includes('%')) throw invalid();
    return value;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) throw invalid();
    return url.href;
  } catch { throw invalid(); }
}
function validated(row: Record<string, unknown>): ManagedProduct {
  if (typeof row['slug'] !== 'string' || typeof row['name'] !== 'string') throw invalid();
  const slug = row['slug'].trim().toLowerCase();
  const name = row['name'].trim();
  const status = row['status'];
  if (!isProductSlug(slug) || !name || name.length > 200
    || typeof status !== 'string' || !['active','coming-soon','draft','archived'].includes(status)
    || typeof row['priceCents'] !== 'number' || !Number.isSafeInteger(row['priceCents']) || row['priceCents'] < 0
    || row['currency'] !== 'eur' || (status === 'active' && row['priceCents'] === 0)) throw invalid();
  const description = row['description'];
  if (description !== null && (typeof description !== 'string' || description.length > 10000)) throw invalid();
  return { slug, name, status: status as ManagedProduct['status'], priceCents: row['priceCents'],
    currency: 'eur', description: typeof description === 'string' ? description.trim() : null,
    imageUrl: image(row['imageUrl']), featureImageUrl: image(row['featureImageUrl']) };
}
export async function createAdminProduct(db: ProductDatabase, payload: unknown) {
  const product = validated({ status: 'draft', currency: 'eur', description: null, imageUrl: null, featureImageUrl: null, ...record(payload) });
  // Create a draft first; activation synchronizes the stable D1 product identity.
  if (product.status === 'active') throw new ProductMutationError(400, 'product_not_purchasable');
  const id = crypto.randomUUID();
  if (!await insertProduct(db, id, product)) throw new ProductMutationError(409, 'slug_conflict');
  return getAdminProduct(db, id);
}
export async function updateAdminProduct(db: ProductDatabase, id: string, payload: unknown,
  clientFactory: () => StripeCatalogueClient) {
  if (!isProductSlug(id)) throw invalid();
  const patch = record(payload);
  const previous = await getAdminProduct(db, id);
  if (!previous) throw new ProductMutationError(404, 'not_found');
  const product = validated({ ...previous, ...patch });
  const client = product.status === 'active' ? clientFactory() : null;
  const mapping = client ? await synchronizeStripeCatalogue(client, previous, product) : previous;
  try {
    if (!await updateProduct(db, previous, product, mapping)) throw new ProductMutationError(409, 'product_changed');
  } catch (error) {
    if (error instanceof ProductSlugConflict) throw new ProductMutationError(409, 'slug_conflict');
    throw error;
  }
  // Never deactivate before the new, verified mapping is committed. Historical snapshots are untouched.
  if (client && previous.stripePriceId && previous.stripePriceId !== mapping.stripePriceId
    && !await isPriceReferenced(db, previous.stripePriceId)) {
    await client.prices.update(previous.stripePriceId, { active: false });
  }
  return getAdminProduct(db, id);
}
export async function archiveAdminProduct(db: ProductDatabase, id: string) {
  if (!isProductSlug(id)) throw invalid();
  if (!await archiveProduct(db, id)) throw new ProductMutationError(404, 'not_found');
  return getAdminProduct(db, id);
}
export async function deleteAdminProduct(db: ProductDatabase, id: string): Promise<{ status: 'deleted' }> {
  if (!isProductSlug(id)) throw invalid();
  if (await deleteUnusedProduct(db, id)) return { status: 'deleted' };
  if (!await getAdminProduct(db, id)) throw new ProductMutationError(404, 'not_found');
  if (await productHasOrders(db, id)) throw new ProductMutationError(409, 'product_has_orders');
  throw new ProductMutationError(409, 'product_not_deletable');
}
