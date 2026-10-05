import { getPublicOrder } from '../../../../server/orders/order.service.ts';
import type { OrderDatabase } from '../../../../server/orders/order.repository.ts';
import { isCheckoutSessionId } from '../../../../src/shared/order-summary.ts';

export async function onRequest(context: {
  request: Request; params: { sessionId?: string | string[] }; env: { PROMO_DB?: OrderDatabase };
}): Promise<Response> {
  const headers = {
    'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow',
  };
  const reply = (status: number, body: unknown) => Response.json(body, { status, headers });
  if (context.request.method !== 'GET') {
    return Response.json({ status: 'method_not_allowed' }, { status: 405, headers: { ...headers, Allow: 'GET' } });
  }
  const origin = context.request.headers.get('Origin');
  if ((origin && origin !== new URL(context.request.url).origin)
    || context.request.headers.get('Sec-Fetch-Site') === 'cross-site') return reply(403, { status: 'forbidden' });
  const sessionId = context.params.sessionId;
  if (!isCheckoutSessionId(sessionId)) return reply(400, { status: 'invalid_request' });
  if (!context.env.PROMO_DB) return reply(503, { status: 'unavailable' });
  try {
    const order = await getPublicOrder(context.env.PROMO_DB, sessionId);
    return order ? reply(200, order) : reply(404, { status: 'pending' });
  } catch { return reply(503, { status: 'unavailable' }); }
}
