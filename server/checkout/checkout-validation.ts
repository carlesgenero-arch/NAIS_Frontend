import { MAX_CART_QUANTITY } from '../../src/shared/cart-limits.ts';
import { isProductSlug, UnavailableCheckoutProductError } from '../catalogue/product.service.ts';

import type { CheckoutEnvironment } from './checkout-env.ts';
import { resolveCheckoutItems, type ResolvedCheckout } from './checkout-resolution.ts';

// Preserve the existing request-size limit independently of catalogue contents.
export const MAX_CHECKOUT_LINES = 5;
const MAX_BODY_BYTES = 4096;

/** Stripe has no Catalan locale; Spanish is NAIS's explicit supported fallback. */
function checkoutLocale(value: unknown): 'es' {
  const language = typeof value === 'string' ? value.trim().toLowerCase() : 'ca';
  const locales = { ca: 'es', es: 'es' } as const;
  return language === 'ca' || language === 'es' ? locales[language] : locales.ca;
}

function response(status: number, result: string): Response {
  return Response.json({ status: result }, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(status === 405 ? { Allow: 'POST' } : {}),
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function readPayload(request: Request): Promise<unknown> {
  if (!request.body) throw new Error('Missing body');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let length = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error('Body too large');
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

export async function validateCheckout(request: Request, env: Partial<CheckoutEnvironment> = {}): Promise<Response | (ResolvedCheckout & { readonly locale: 'es' })> {
  if (request.method !== 'POST') return response(405, 'method_not_allowed');
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return response(415, 'invalid_payload');
  }
  let payload: unknown;
  try { payload = await readPayload(request); }
  catch { return response(400, 'invalid_payload'); }
  if (!isRecord(payload) || Object.keys(payload).some(key => key !== 'items' && key !== 'locale')
    || !Object.hasOwn(payload, 'items')) {
    return response(400, 'invalid_payload');
  }
  const items = payload['items'];
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_CHECKOUT_LINES) {
    return response(400, 'invalid_items');
  }
  const quantities = new Map<string, number>();
  for (const item of items) {
    if (!isRecord(item) || Object.keys(item).length !== 2
      || !Object.hasOwn(item, 'productId') || !Object.hasOwn(item, 'quantity')) {
      return response(400, 'invalid_item');
    }
    const productId = item['productId'];
    const quantity = item['quantity'];
    if (!isProductSlug(productId)) return response(400, 'invalid_product');
    if (typeof quantity !== 'number' || !Number.isFinite(quantity) || !Number.isInteger(quantity)
      || quantity < 1 || quantity > MAX_CART_QUANTITY) {
      return response(400, 'invalid_quantity');
    }
    // Duplicate lines count toward the same per-product limit, never clamp silently.
    const combined = (quantities.get(productId) ?? 0) + quantity;
    if (combined > MAX_CART_QUANTITY) return response(400, 'invalid_quantity');
    quantities.set(productId, combined);
  }
  try {
    return { ...await resolveCheckoutItems(quantities, env), locale: checkoutLocale(payload['locale']) };
  } catch (error) {
    if (error instanceof UnavailableCheckoutProductError) return response(400, 'invalid_product');
    return response(503, 'unavailable');
  }
}
