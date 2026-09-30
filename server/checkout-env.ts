/** Cloudflare Pages bindings only. Never import this module into Angular. */
export interface CheckoutPriceBindings {
  STRIPE_PRICE_ORANGE_SPRITZ: string;
  STRIPE_PRICE_PASSION_HUGO: string;
  STRIPE_PRICE_GINGER_CRUSH: string;
  STRIPE_PRICE_TROPICAL_HOPS: string;
  STRIPE_PRICE_PACK_VARIAT: string;
}

export interface CheckoutEnvironment extends CheckoutPriceBindings {
  STRIPE_SECRET_KEY: string;
  SITE_URL: string;
  /** Reserved for the later webhook implementation; not required yet. */
  STRIPE_WEBHOOK_SECRET?: string;
}
