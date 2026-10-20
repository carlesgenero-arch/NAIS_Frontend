import type { AdminReadContext } from './admin-read.ts';
import { OrderArchiveError, setOrderArchived } from '../orders/order-archive.service.ts';

/** Accept zero bytes, not merely a null stream. Never decode or accumulate request content. */
async function hasEmptyBody(request: Request): Promise<boolean> {
  if (!request.body) return true;
  const reader = request.body.getReader();
  try {
    // Bound reads even for an unusual stream emitting repeated zero-length chunks.
    for (let reads = 0; reads < 16; reads++) {
      const chunk = await reader.read();
      if (chunk.done) return true;
      if (chunk.value.byteLength > 0) return false;
    }
    return false;
  } catch { return false; }
  finally {
    try { await reader.cancel(); } catch { /* Invalid stream remains rejected. */ }
    reader.releaseLock();
  }
}

export async function adminOrderArchive(context: AdminReadContext, archived: boolean): Promise<Response> {
  const reply = (status: number, value: unknown, extra = {}) => Response.json(value, { status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
  if (!context.data.admin) return reply(401, { status: 'unauthenticated' });
  if (context.request.method !== 'POST') return reply(405, { status: 'method_not_allowed' }, { Allow: 'POST' });
  if (context.request.headers.get('Origin') !== new URL(context.request.url).origin) return reply(403, { status: 'forbidden' });
  if (!await hasEmptyBody(context.request)) return reply(400, { status: 'invalid_request' });
  if (!context.env.PROMO_DB) return reply(503, { status: 'unavailable' });
  try { return reply(200, await setOrderArchived(context.env.PROMO_DB, context.params?.id, archived)); }
  catch (error) { return error instanceof OrderArchiveError
    ? reply(error.status, { status: error.code }) : reply(503, { status: 'unavailable' }); }
}
