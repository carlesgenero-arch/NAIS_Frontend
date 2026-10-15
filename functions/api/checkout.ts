import { enforceCheckoutRateLimit } from '../../server/checkout/checkout-rate-limit.ts';
import { checkout } from '../../server/checkout/checkout-session.ts';
import type { CheckoutEnvironment } from '../../server/checkout/checkout-env.ts';

export async function onRequest(context: { request: Request; env?: Partial<CheckoutEnvironment> }): Promise<Response> {
  const limited = await enforceCheckoutRateLimit(context.request, context.env?.CHECKOUT_RATE_LIMITER);
  if (limited) return limited;
  return checkout(context.request, context.env);
}
