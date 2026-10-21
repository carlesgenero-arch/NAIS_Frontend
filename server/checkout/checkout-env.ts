import type { StripeSafetyEnvironment } from '../stripe/stripe-safety.ts';
import type { CheckoutRateLimiterService } from './checkout-rate-limit.ts';
import type { ProductDatabase } from '../catalogue/product.repository.ts';

/** Cloudflare Pages bindings only. Never import this module into Angular. */
export interface CheckoutEnvironment extends StripeSafetyEnvironment {
  CHECKOUT_RATE_LIMITER: CheckoutRateLimiterService;
  PROMO_DB: ProductDatabase;
  STRIPE_SECRET_KEY: string;
  SITE_URL: string;
  /** Required only by the webhook endpoint, never by session creation. */
  STRIPE_WEBHOOK_SECRET?: string;
}
