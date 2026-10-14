import type Stripe from 'stripe';
import { shippingAmountCents } from '../../src/shared/shipping-rules.ts';

/** Quantities represent boxes, never individual cans. */
export const UNITS_PER_BOX = 16;
export { FREE_SHIPPING_MIN_BOXES, SHIPPING_PRICE_EUR } from '../../src/shared/shipping-rules.ts';
export const CHECKOUT_CURRENCY = 'eur';

/** For the future hosted Session: let Stripe validate codes; no client coupon config. */
export const HOSTED_CHECKOUT_OPTIONS = Object.freeze({
  mode: 'payment',
  allow_promotion_codes: true,
} as const satisfies Pick<Stripe.Checkout.SessionCreateParams, 'mode' | 'allow_promotion_codes'>);

/** Accept only the sum of validated server-side item quantities, never a browser total. */
export function checkoutShippingOption(totalBoxes: number): Stripe.Checkout.SessionCreateParams.ShippingOption {
  if (!Number.isSafeInteger(totalBoxes) || totalBoxes < 1) {
    throw new Error('Shipping requires a positive integer box count');
  }
  const amount = shippingAmountCents(totalBoxes);
  const free = amount === 0;
  return {
    shipping_rate_data: {
      type: 'fixed_amount',
      fixed_amount: {
        amount,
        currency: CHECKOUT_CURRENCY,
      },
      display_name: free ? 'Enviament gratuït' : 'Enviament estàndard',
    },
  };
}
