import type { AdminReadContext } from './admin-read.ts';
import { changeOrderFulfillment, FulfillmentError } from '../orders/order-fulfillment.service.ts';

async function readPayload(request: Request): Promise<unknown> {
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json' || !request.body) {
    throw new FulfillmentError(400, 'invalid_payload');
  }
  const reader = request.body.getReader(); const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0; let text = '';
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      bytes += part.value.length;
      if (bytes > 1024) { await reader.cancel(); throw new Error(); }
      text += decoder.decode(part.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch { throw new FulfillmentError(400, 'invalid_payload'); }
  finally { reader.releaseLock(); }
}
export async function adminOrderFulfillment(context: AdminReadContext): Promise<Response> {
  const reply = (status: number, value: unknown, extra = {}) => Response.json(value, { status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
  if (!context.data.admin) return reply(401, { status: 'unauthenticated' });
  if (context.request.method !== 'PATCH') return reply(405, { status: 'method_not_allowed' }, { Allow: 'PATCH' });
  if (!context.env.PROMO_DB) return reply(503, { status: 'unavailable' });
  try {
    return reply(200, await changeOrderFulfillment(context.env.PROMO_DB, context.params?.id, await readPayload(context.request)));
  } catch (error) {
    return error instanceof FulfillmentError ? reply(error.status, { status: error.code }) : reply(503, { status: 'unavailable' });
  }
}
