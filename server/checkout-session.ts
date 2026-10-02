import type Stripe from 'stripe';
import type { CheckoutEnvironment } from './checkout-env.ts';
import { validateCheckout } from './checkout-validation.ts';
import { HOSTED_CHECKOUT_OPTIONS } from './checkout-rules.ts';
import { createStripeClient } from './stripe-client.ts';

// Narrow SDK boundary permits tests without real API calls.
export interface CheckoutClient {
  checkout: { sessions: {
    create(params: Stripe.Checkout.SessionCreateParams): Promise<{ url: string | null }>;
  } };
}
type ClientFactory = (env: Pick<CheckoutEnvironment, 'STRIPE_SECRET_KEY'>) => CheckoutClient;

function json(status: number, body: { status: string } | { url: string }): Response {
  return Response.json(body, { status, headers: {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  } });
}

function siteOrigin(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Missing site origin');
  const url = new URL(value);
  const local = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((!local && url.protocol !== 'https:') || url.username || url.password
    || url.pathname !== '/' || url.search || url.hash) throw new Error('Invalid site origin');
  return url.origin;
}

export async function checkout(
  request: Request,
  env: Partial<CheckoutEnvironment> = {},
  clientFactory: ClientFactory = createStripeClient,
): Promise<Response> {
  try {
    const origin = request.headers.get('Origin');
    if (origin && origin !== new URL(request.url).origin) return json(403, { status: 'forbidden' });
    const resolved = await validateCheckout(request, env);
    if (resolved instanceof Response) return resolved;
    let site: string;
    let client: CheckoutClient;
    try {
      site = siteOrigin(env.SITE_URL);
      if (typeof env.STRIPE_SECRET_KEY !== 'string' || !env.STRIPE_SECRET_KEY.trim()) {
        return json(503, { status: 'unavailable' });
      }
      client = clientFactory({ STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY });
    } catch {
      return json(503, { status: 'unavailable' });
    }
    try {
      const session = await client.checkout.sessions.create({
        ...HOSTED_CHECKOUT_OPTIONS,
        // Stripe collects email directly; no customer data is accepted from Angular.
        customer_creation: 'always',
        shipping_address_collection: { allowed_countries: ['ES'] },
        name_collection: { individual: { enabled: true, optional: false } },
        phone_number_collection: { enabled: true },
        line_items: [...resolved.items],
        shipping_options: [...resolved.shippingOptions],
        success_url: `${site}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${site}/checkout/cancel`,
      });
      if (!session.url) return json(502, { status: 'checkout_unavailable' });
      const url = new URL(session.url);
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com'
        || url.port || url.username || url.password) {
        return json(502, { status: 'checkout_unavailable' });
      }
      return json(200, { url: session.url });
    } catch {
      // Never disclose Stripe errors, credentials, response bodies or stack traces.
      return json(502, { status: 'checkout_unavailable' });
    }
  } catch {
    return json(500, { status: 'unavailable' });
  }
}
