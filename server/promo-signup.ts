import type Stripe from 'stripe';
import { createStripeClient } from './stripe-client.ts';

/** Minimal D1 contract: implemented by the Pages PROMO_DB binding. */
export interface PromoDatabase {
  prepare(sql: string): {
    bind(...values: string[]): {
      run(): Promise<{ success: boolean; meta: { changes: number } }>;
      first<T>(): Promise<T | null>;
    };
  };
}

export interface PromoEnvironment {
  PROMO_DB?: PromoDatabase;
  STRIPE_SECRET_KEY?: string;
  STRIPE_PROMO_COUPON_ID?: string;
}

export interface PromoStripeClient {
  coupons: { retrieve(id: string): Promise<{ valid: boolean; percent_off: number | null }> };
  promotionCodes: {
    create(params: Stripe.PromotionCodeCreateParams, options: Stripe.RequestOptions): Promise<{ id: string; code: string }>;
  };
}
type PromoClientFactory = (env: { STRIPE_SECRET_KEY: string }) => PromoStripeClient;

const MAX_BODY_BYTES = 2048;

function response(status: number, result: string): Response {
  return Response.json({ status: result }, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      ...(status === 405 ? { Allow: 'POST' } : {}),
    },
  });
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254) return null;
  const parts = email.split('@');
  if (parts.length !== 2) return null;
  const [local, domain] = parts;
  if (!local || local.length > 64 || !/^[a-z0-9._%+-]+$/.test(local)
    || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return null;
  const labels = domain.split('.');
  if (labels.length < 2 || !/^[a-z]{2,}$/.test(labels[labels.length - 1])) return null;
  if (labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
  return email;
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

export async function promoSignup(
  request: Request, env: PromoEnvironment, clientFactory: PromoClientFactory = createStripeClient,
): Promise<Response> {
  if (request.method !== 'POST') return response(405, 'method_not_allowed');
  // No cross-origin browser submissions; no CORS permission is exposed.
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return response(403, 'forbidden');
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return response(415, 'invalid_payload');
  }
  let payload: unknown;
  try { payload = await readPayload(request); }
  catch { return response(400, 'invalid_payload'); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return response(400, 'invalid_payload');
  const fields = payload as Record<string, unknown>;
  // Reject client-supplied eligibility flags rather than persisting them.
  if (Object.keys(fields).length !== 1 || !Object.hasOwn(fields, 'email')) return response(400, 'invalid_payload');
  const email = normalizeEmail(fields['email']);
  if (!email) return response(400, 'invalid_email');
  if (!env.PROMO_DB) return response(503, 'unavailable');
  try {
    if (!env.STRIPE_SECRET_KEY?.trim() || !env.STRIPE_PROMO_COUPON_ID?.trim()) {
      return response(503, 'unavailable');
    }
    const client = clientFactory({ STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY });
    // Durable opaque correlation/idempotency key; never send the email to Stripe.
    const requestId = crypto.randomUUID();
    // Uniqueness check and registration are one atomic write, never SELECT then INSERT.
    const result = await env.PROMO_DB.prepare(
      'INSERT INTO promo_signups (email, promotion_request_id) VALUES (?1, ?2) ON CONFLICT(email) DO NOTHING',
    ).bind(email, requestId).run();
    if (!result.success) return response(503, 'unavailable');
    if (result.meta.changes === 0) {
      const existing = await env.PROMO_DB.prepare(
        'SELECT promotion_request_id, stripe_promotion_code_id, promotion_code FROM promo_signups WHERE email = ?1',
      ).bind(email).first<{ promotion_request_id: string | null; stripe_promotion_code_id: string | null; promotion_code: string | null }>();
      // Legacy registrations stay duplicates; unfinished new registrations never claim success.
      if (existing && (!existing.promotion_request_id || (existing.stripe_promotion_code_id && existing.promotion_code))) {
        return response(200, 'already_registered');
      }
      return response(503, 'unavailable');
    }
    if (result.meta.changes !== 1) return response(503, 'unavailable');
    const coupon = await client.coupons.retrieve(env.STRIPE_PROMO_COUPON_ID);
    if (!coupon.valid || coupon.percent_off !== 10) return response(503, 'unavailable');
    const promotion = await client.promotionCodes.create({
      promotion: { type: 'coupon', coupon: env.STRIPE_PROMO_COUPON_ID },
      max_redemptions: 1,
      restrictions: { first_time_transaction: true },
      metadata: { nais_promo_request_id: requestId },
    }, { idempotencyKey: `nais-promo-${requestId}` });
    if (!promotion.id?.trim() || !promotion.code?.trim()) return response(503, 'unavailable');
    const saved = await env.PROMO_DB.prepare(
      'UPDATE promo_signups SET stripe_promotion_code_id = ?1, promotion_code = ?2 WHERE email = ?3 AND promotion_request_id = ?4 AND stripe_promotion_code_id IS NULL',
    ).bind(promotion.id, promotion.code, email, requestId).run();
    if (!saved.success || saved.meta.changes !== 1) return response(503, 'unavailable');
    // delivery_status stays pending: code generation does not mean email delivery.
    // Keep failed reservations for manual reconciliation; never blindly issue a replacement.
    return response(201, 'registered');
  } catch {
    // Never return SQL, binding details or email addresses to the client or logs.
    return response(503, 'unavailable');
  }
}
