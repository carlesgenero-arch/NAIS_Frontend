import { checkout } from '../../server/checkout/checkout-session.ts';
import type { CheckoutEnvironment } from '../../server/checkout/checkout-env.ts';

export function onRequest(context: { request: Request; env?: Partial<CheckoutEnvironment> }): Promise<Response> {
  return checkout(context.request, context.env);
}
