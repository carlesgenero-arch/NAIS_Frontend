import type { AdminReadContext } from './admin-read.ts';
import { isProductSlug } from '../catalogue/product.service.ts';
import { imageFile, ImageUploadError, type ProductImagesEnvironment } from '../images/product-images.ts';
export interface AdminProductImageContext extends Omit<AdminReadContext, 'env'> {
  env: AdminReadContext['env'] & ProductImagesEnvironment;
}
export async function adminProductImage(context: AdminProductImageContext): Promise<Response> {
  const reply = (status: number, body: unknown, extra = {}) => Response.json(body, { status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
  if (!context.data.admin) return reply(401, { status: 'unauthenticated' });
  if (context.request.method !== 'POST') return reply(405, { status: 'method_not_allowed' }, { Allow: 'POST' });
  if (context.request.headers.get('Origin') !== new URL(context.request.url).origin) return reply(403, { status: 'forbidden' });
  const id = context.params?.id;
  if (!isProductSlug(id)) return reply(400, { status: 'invalid_request' });
  const db = context.env.PROMO_DB, bucket = context.env.PRODUCT_IMAGES;
  if (!db || !bucket) return reply(503, { status: 'unavailable' });
  try {
    const previous = await db.prepare('SELECT image_url AS imageUrl, updated_at AS updatedAt FROM products WHERE id=?')
      .bind(id).first<{ imageUrl: string | null; updatedAt: string }>();
    if (!previous) return reply(404, { status: 'not_found' });
    const file = await imageFile(context.request);
    const key = `products/${id}/${crypto.randomUUID()}.${file.extension}`;
    if (!await bucket.put(key, file.bytes, { httpMetadata: { contentType: file.mime,
      cacheControl: 'public, max-age=31536000, immutable' } })) throw new Error('Upload unavailable');
    const imageUrl = `/images/uploads/${key}`;
    const saved = await db.prepare(`UPDATE products SET image_url=?1, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id=?2 AND image_url IS ?3 AND updated_at IS ?4 RETURNING image_url AS imageUrl, updated_at AS updatedAt`)
      .bind(imageUrl, id, previous.imageUrl, previous.updatedAt).first<{ imageUrl: string; updatedAt: string }>();
    // Retain new/old objects even on ambiguous writes. Never delete a potentially current image.
    return saved ? reply(200, saved) : reply(409, { status: 'product_changed' });
  } catch (error) {
    return error instanceof ImageUploadError ? reply(error.status, { status: error.code }) : reply(503, { status: 'unavailable' });
  }
}
