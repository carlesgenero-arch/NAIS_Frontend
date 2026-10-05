import Stripe from 'stripe';

/** Lazy, server-only construction: no credentials needed at Angular build time. */
export function createStripeClient(env: { STRIPE_SECRET_KEY: string }): Stripe {
  if (typeof env.STRIPE_SECRET_KEY !== 'string' || !env.STRIPE_SECRET_KEY.trim()) {
    throw new Error('Stripe secret binding is missing');
  }
  return new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
    timeout: 15000,
    telemetry: false,
  });
}
