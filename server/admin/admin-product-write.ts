import type { AdminReadContext } from './admin-read.ts';
import { createAdminProduct, updateAdminProduct, archiveAdminProduct, ProductMutationError } from '../catalogue/product-write.service.ts';
import { createStripeClient } from '../stripe/stripe-client.ts';
import type { CheckoutClient } from '../checkout/checkout-session.ts';
export interface AdminProductWriteContext extends AdminReadContext {
  env: AdminReadContext['env'] & { STRIPE_SECRET_KEY?: string };
}
async function body(request: Request, allowEmpty = false): Promise<unknown> {
  const isJson = request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() === 'application/json';
  if ((!allowEmpty && !isJson) || !request.body) {
    throw new ProductMutationError(400, 'invalid_payload');
  }
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0, text = '';
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 32768) { await reader.cancel(); throw new Error(); }
      text += decoder.decode(part.value, { stream: true });
    }
    // Cloudflare may expose a non-null stream even when the POST contains zero bytes.
    if (allowEmpty && size === 0) return {};
    if (!isJson) throw new Error();
    return JSON.parse(text + decoder.decode());
  } catch { throw new ProductMutationError(400, 'invalid_payload'); }
  finally { reader.releaseLock(); }
}
export async function adminProductWrite(context: AdminProductWriteContext, action: 'create' | 'update' | 'archive',
  clientFactory: (env: { STRIPE_SECRET_KEY: string }) => Pick<CheckoutClient, 'prices'> = createStripeClient): Promise<Response> {
  const reply = (status: number, value: unknown, headers = {}) => Response.json(value, { status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
  if (!context.data.admin) return reply(401, { status: 'unauthenticated' });
  const method = action === 'update' ? 'PATCH' : 'POST';
  if (context.request.method !== method) return reply(405, { status: 'method_not_allowed' }, { Allow: method });
  if (!context.env.PROMO_DB) return reply(503, { status: 'unavailable' });
  try {
    const id = context.params?.id;
    if (action !== 'create' && typeof id !== 'string') throw new ProductMutationError(400, 'invalid_payload');
    const productId = typeof id === 'string' ? id : '';
    if (action === 'archive') {
      // Archive takes no fields: accept an empty body or an empty JSON object.
      if (context.request.body) {
        const value = await body(context.request, true);
        if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length) {
          throw new ProductMutationError(400, 'invalid_payload');
        }
      }
      return reply(200, await archiveAdminProduct(context.env.PROMO_DB, productId));
    }
    const payload = await body(context.request);
    const result = action === 'create' ? await createAdminProduct(context.env.PROMO_DB, payload)
      : await updateAdminProduct(context.env.PROMO_DB, productId, payload,
        () => clientFactory({ STRIPE_SECRET_KEY: context.env.STRIPE_SECRET_KEY ?? '' }));
    return reply(action === 'create' ? 201 : 200, result);
  } catch (error) {
    return error instanceof ProductMutationError ? reply(error.status, { status: error.code })
      : reply(503, { status: 'unavailable' });
  }
}
