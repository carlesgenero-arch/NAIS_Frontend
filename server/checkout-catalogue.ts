import type { CheckoutPriceBindings } from './checkout-env.ts';

/** Explicit server allowlist. Coming-soon products must not be included. */
export const CHECKOUT_CATALOGUE = Object.freeze({
  'orange-spritz': 'STRIPE_PRICE_ORANGE_SPRITZ',
  'passion-hugo': 'STRIPE_PRICE_PASSION_HUGO',
  'ginger-crush': 'STRIPE_PRICE_GINGER_CRUSH',
  'tropical-hops': 'STRIPE_PRICE_TROPICAL_HOPS',
  'pack-variat': 'STRIPE_PRICE_PACK_VARIAT',
} as const satisfies Record<string, keyof CheckoutPriceBindings>);

export type CheckoutProductId = keyof typeof CHECKOUT_CATALOGUE;

export function isCheckoutProductId(value: unknown): value is CheckoutProductId {
  return typeof value === 'string' && Object.hasOwn(CHECKOUT_CATALOGUE, value);
}

/** Unknown IDs return null; missing/invalid server configuration fails closed. */
export function resolveCheckoutPrice(productId: unknown, env: Partial<CheckoutPriceBindings>): string | null {
  if (!isCheckoutProductId(productId)) return null;
  const priceId = env[CHECKOUT_CATALOGUE[productId]];
  if (typeof priceId !== 'string' || !/^price_[a-zA-Z0-9]+$/.test(priceId)) {
    throw new Error('Checkout price binding is missing or invalid');
  }
  return priceId;
}
