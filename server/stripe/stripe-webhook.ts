import Stripe from 'stripe';
import { createStripeClient } from './stripe-client.ts';
import { CHECKOUT_CATALOGUE } from '../checkout/checkout-catalogue.ts';
import type { CheckoutPriceBindings } from '../checkout/checkout-env.ts';
import { createPaidOrder, hasOrderForSession } from '../orders/order.service.ts';
import type { OrderDatabase } from '../orders/order.repository.ts';
import type { PaidOrderSnapshot } from '../orders/order.types.ts';

export type { OrderDatabase } from '../orders/order.repository.ts';
export interface WebhookEnvironment extends Partial<CheckoutPriceBindings> {
  PROMO_DB?: OrderDatabase;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}
export interface WebhookClient {
  checkout: { sessions: {
    retrieve(id: string): Promise<Stripe.Checkout.Session>;
    listLineItems(id: string, params: Stripe.Checkout.SessionListLineItemsParams): Promise<Stripe.ApiList<Stripe.LineItem>>;
  } };
}
type ClientFactory = (env: { STRIPE_SECRET_KEY: string }) => WebhookClient;

function reply(status: number): Response {
  return Response.json({ status: status === 200 ? 'received' : 'unavailable' }, {
    status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      ...(status === 405 ? { Allow: 'POST' } : {}) },
  });
}
function required(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Missing snapshot field');
  return value;
}
function amount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Invalid amount');
  return value;
}
function objectId(value: string | { id: string } | null): string | null {
  return value === null ? null : required(typeof value === 'string' ? value : value.id);
}
async function rawBody(request: Request): Promise<string> {
  if (!request.body) throw new Error('Missing body');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let body = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 1024 * 1024) { await reader.cancel(); throw new Error('Body too large'); }
      body += decoder.decode(chunk.value, { stream: true });
    }
    return body + decoder.decode();
  } finally { reader.releaseLock(); }
}

/** IDs only may use the current binding map; historical names/prices never do. */
function productId(line: Stripe.LineItem, env: WebhookEnvironment): string {
  const price = line.price;
  if (!price) throw new Error('Missing price');
  const product = price.product;
  const metadataId = typeof product === 'object' && !('deleted' in product && product.deleted)
    ? product.metadata['nais_product_id'] : undefined;
  if (metadataId) return required(metadataId);
  const matches = Object.entries(CHECKOUT_CATALOGUE).filter(([, binding]) => env[binding] === price.id);
  if (matches.length !== 1) throw new Error('Unmapped product');
  return matches[0][0];
}

async function savePaidSession(event: Stripe.Event, env: WebhookEnvironment, client: WebhookClient): Promise<void> {
  const sessionRef = event.data.object as Stripe.Checkout.Session;
  if (sessionRef.object !== 'checkout.session' || !/^cs_[a-zA-Z0-9_]+$/.test(required(sessionRef.id))) {
    throw new Error('Invalid session');
  }
  const db = env.PROMO_DB!;
  if (await hasOrderForSession(db, sessionRef.id)) return;
  // Fetch full authoritative data using the server key, never redirect/query data.
  const session = await client.checkout.sessions.retrieve(sessionRef.id);
  if (session.id !== sessionRef.id || session.livemode !== event.livemode) throw new Error('Session mismatch');
  if (session.mode !== 'payment' || session.status !== 'complete' || session.payment_status !== 'paid') return;
  const lines: Stripe.LineItem[] = [];
  let cursor: string | undefined;
  do {
    const page = await client.checkout.sessions.listLineItems(session.id, {
      limit: 100, expand: ['data.price.product'], ...(cursor ? { starting_after: cursor } : {}),
    });
    if (!page.data.length || lines.length + page.data.length > 100) throw new Error('Invalid line count');
    lines.push(...page.data);
    const next = page.has_more ? required(page.data[page.data.length - 1].id) : undefined;
    if (next && next === cursor) throw new Error('Invalid pagination');
    cursor = next;
  } while (cursor);
  const currency = required(session.currency);
  const subtotal = amount(session.amount_subtotal);
  const total = amount(session.amount_total);
  const shipping = amount(session.total_details?.amount_shipping);
  const discount = amount(session.total_details?.amount_discount);
  const tax = amount(session.total_details?.amount_tax);
  if (lines.reduce((sum, line) => sum + amount(line.amount_subtotal), 0) !== subtotal) throw new Error('Incomplete snapshot');
  const details = session.customer_details;
  const recipient = session.collected_information?.shipping_details;
  const address = recipient?.address;
  const paidAt = new Date(amount(event.created) * 1000).toISOString();
  const snapshot: PaidOrderSnapshot = {
    stripe_checkout_session_id: session.id,
    stripe_event_id: required(event.id),
    stripe_payment_intent_id: required(objectId(session.payment_intent)),
    stripe_customer_id: objectId(session.customer),
    customer_name: required(details?.name ?? session.collected_information?.individual_name ?? recipient?.name),
    customer_email: required(details?.email),
    customer_phone: details?.phone ?? null,
    shipping_name: required(recipient?.name),
    shipping_address_line1: required(address?.line1),
    shipping_address_line2: address?.line2 ?? null,
    shipping_postal_code: required(address?.postal_code),
    shipping_city: required(address?.city),
    shipping_country: required(address?.country),
    subtotal_amount: subtotal,
    shipping_amount: shipping,
    discount_amount: discount,
    tax_amount: tax,
    total_amount: total,
    currency,
    paid_at: paidAt,
    items: lines.map(line => {
      const quantity = amount(line.quantity);
      if (!quantity || line.currency !== currency || line.price?.currency !== currency) throw new Error('Invalid line');
      return {
        stripe_line_item_id: required(line.id), product_id: productId(line, env), product_name: required(line.description),
        stripe_price_id: required(line.price?.id), quantity, unit_amount: amount(line.price?.unit_amount),
        line_total_amount: amount(line.amount_total),
      };
    }),
  };
  await createPaidOrder(db, snapshot);
}

export async function stripeWebhook(request: Request, env: WebhookEnvironment, clientFactory: ClientFactory = createStripeClient): Promise<Response> {
  if (request.method !== 'POST') return reply(405);
  if (!env.STRIPE_WEBHOOK_SECRET?.trim()) return reply(503);
  const signature = request.headers.get('Stripe-Signature');
  if (!signature) return reply(400);
  let event: Stripe.Event;
  try {
    event = await Stripe.webhooks.constructEventAsync(await rawBody(request), signature,
      env.STRIPE_WEBHOOK_SECRET, undefined, Stripe.createSubtleCryptoProvider());
    if (event.object !== 'event' || !event.id || typeof event.type !== 'string'
      || !event.data?.object || !Number.isSafeInteger(event.created) || typeof event.livemode !== 'boolean') return reply(400);
  } catch { return reply(400); }
  // Add async_payment_succeeded here later with its own payment-status policy/tests.
  if (event.type !== 'checkout.session.completed') return reply(200);
  if (!env.PROMO_DB || !env.STRIPE_SECRET_KEY?.trim()) return reply(503);
  try {
    await savePaidSession(event, env, clientFactory({ STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY }));
    return reply(200);
  } catch { return reply(503); } // Stripe retries; never return/log customer data or internal errors.
}
