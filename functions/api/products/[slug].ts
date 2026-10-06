import { getPublicProductBySlug, isProductSlug } from '../../../server/catalogue/product.service.ts';
import type { ProductDatabase } from '../../../server/catalogue/product.repository.ts';

export async function onRequest(context: {
  request: Request; params: { slug?: string | string[] }; env: { PROMO_DB?: ProductDatabase };
}): Promise<Response> {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  const reply = (status: number, body: unknown) => Response.json(body, { status, headers });
  if (context.request.method !== 'GET') {
    return Response.json({ status: 'method_not_allowed' }, { status: 405, headers: { ...headers, Allow: 'GET' } });
  }
  const slug = context.params.slug;
  if (!isProductSlug(slug)) return reply(400, { status: 'invalid_request' });
  if (!context.env.PROMO_DB) return reply(503, { status: 'unavailable' });
  try {
    const product = await getPublicProductBySlug(context.env.PROMO_DB, slug);
    return product ? reply(200, product) : reply(404, { status: 'not_found' });
  } catch { return reply(503, { status: 'unavailable' }); }
}
