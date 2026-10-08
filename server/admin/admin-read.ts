import type { AdminIdentity } from './admin-auth.ts';
import type { ProductDatabase } from '../catalogue/product.repository.ts';
import type { AdminOrderDatabase } from '../orders/order.repository.ts';
import { InvalidAdminOrderQuery } from '../orders/admin-order.service.ts';

export class InvalidAdminReadRequest extends Error {}

export interface AdminReadContext {
  request: Request;
  env: { PROMO_DB?: ProductDatabase & AdminOrderDatabase };
  data: { admin?: AdminIdentity };
  params?: { id?: string | string[] };
}
/** HTTP handling only. Identity is established exclusively by parent Access middleware. */
export async function adminRead(context: AdminReadContext,
  read: (db: ProductDatabase & AdminOrderDatabase) => Promise<unknown>): Promise<Response> {
  const reply = (status: number, body: unknown, extra = {}) => Response.json(body, { status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
  if (!context.data.admin) return reply(401, { status: 'unauthenticated' });
  if (context.request.method !== 'GET') return reply(405, { status: 'method_not_allowed' }, { Allow: 'GET' });
  if (!context.env.PROMO_DB) return reply(503, { status: 'unavailable' });
  try {
    const value = await read(context.env.PROMO_DB);
    return value === null ? reply(404, { status: 'not_found' }) : reply(200, value);
  } catch (error) {
    return error instanceof InvalidAdminOrderQuery || error instanceof InvalidAdminReadRequest
      ? reply(400, { status: 'invalid_request' }) : reply(503, { status: 'unavailable' });
  }
}
