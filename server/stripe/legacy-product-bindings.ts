/** Historical webhook fallback only. Never use this map for new checkout eligibility or pricing.
 * Retain the old environment bindings while pre-D1 Sessions may still be delivered/retried.
 */
export const LEGACY_PRODUCT_PRICE_BINDINGS = Object.freeze({
  'orange-spritz': 'STRIPE_PRICE_ORANGE_SPRITZ',
  'passion-hugo': 'STRIPE_PRICE_PASSION_HUGO',
  'ginger-crush': 'STRIPE_PRICE_GINGER_CRUSH',
  'tropical-hops': 'STRIPE_PRICE_TROPICAL_HOPS',
  'pack-variat': 'STRIPE_PRICE_PACK_VARIAT',
} as const);

export type LegacyProductPriceBindings = Record<
  (typeof LEGACY_PRODUCT_PRICE_BINDINGS)[keyof typeof LEGACY_PRODUCT_PRICE_BINDINGS], string
>;
