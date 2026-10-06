import type Stripe from 'stripe';

/** Quantities represent boxes, never individual cans. */
export const UNITS_PER_BOX = 16;
export const SHIPPING_PRICE_EUR = 6;
export const FREE_SHIPPING_MIN_BOXES = 2;
export const CHECKOUT_CURRENCY = 'eur';
const EUR_MINOR_UNITS = 100;

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
  const free = totalBoxes >= FREE_SHIPPING_MIN_BOXES;
  return {
    shipping_rate_data: {
      type: 'fixed_amount',
      fixed_amount: {
        amount: free ? 0 : SHIPPING_PRICE_EUR * EUR_MINOR_UNITS,
        currency: CHECKOUT_CURRENCY,
      },
      display_name: free ? 'Enviament gratuït' : 'Enviament estàndard',
    },
  };
}
