import { isProductImageKey, type ProductImagesEnvironment } from '../../../server/images/product-images.ts';
/** Public read-only asset delivery. The bucket itself stays private. */
export async function onRequest(context: { request: Request; env: ProductImagesEnvironment; params: { path?: string | string[] } }): Promise<Response> {
  const fail = (status: number, extra = {}) => new Response(null, { status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
  if (!['GET', 'HEAD'].includes(context.request.method)) return fail(405, { Allow: 'GET, HEAD' });
  const path = context.params.path;
  const key = Array.isArray(path) ? path.join('/') : path ?? '';
  if (!isProductImageKey(key)) return fail(404);
  if (!context.env.PRODUCT_IMAGES) return fail(503);
  try {
    const object = await context.env.PRODUCT_IMAGES.get(key);
    if (!object) return fail(404);
    const mime = key.endsWith('.jpg') ? 'image/jpeg' : key.endsWith('.png') ? 'image/png' : 'image/webp';
    if (context.request.method === 'HEAD') await object.body.cancel();
    return new Response(context.request.method === 'HEAD' ? null : object.body, { headers: {
      'Content-Type': mime, 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline',
      'Cache-Control': 'public, max-age=31536000, immutable', ETag: object.httpEtag } });
  } catch { return fail(503); }
}
