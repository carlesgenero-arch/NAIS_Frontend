import Stripe from 'stripe';
import type { CheckoutEnvironment } from './checkout-env.ts';

/** Lazy, server-only construction: no credentials needed at Angular build time. */
export function createStripeClient(env: Pick<CheckoutEnvironment, 'STRIPE_SECRET_KEY'>): Stripe {
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
