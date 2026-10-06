import { listActiveProducts } from '../../../server/catalogue/product.service.ts';
import type { ProductDatabase } from '../../../server/catalogue/product.repository.ts';

export async function onRequest(context: {
  request: Request; env: { PROMO_DB?: ProductDatabase };
}): Promise<Response> {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  const reply = (status: number, body: unknown) => Response.json(body, { status, headers });
  if (context.request.method !== 'GET') {
    return Response.json({ status: 'method_not_allowed' }, { status: 405, headers: { ...headers, Allow: 'GET' } });
  }
  if (!context.env.PROMO_DB) return reply(503, { status: 'unavailable' });
  try {
    return reply(200, await listActiveProducts(context.env.PROMO_DB));
  } catch { return reply(503, { status: 'unavailable' }); }
}
