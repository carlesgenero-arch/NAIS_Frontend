import type { CheckoutEnvironment } from './checkout-env.ts';
import { checkoutShippingOption } from './checkout-rules.ts';
import { getPurchasableProducts } from '../catalogue/product.service.ts';
import type { PurchasableProduct } from '../catalogue/product.types.ts';

/** Server-only result; price configuration must never be serialized to the browser. */
export interface ResolvedCheckout {
  readonly items: readonly { readonly price: string; readonly quantity: number }[];
  readonly products: readonly PurchasableProduct[];
  readonly totalBoxes: number;
  readonly shippingOptions: readonly [ReturnType<typeof checkoutShippingOption>];
}

/** Receives validated, merged quantities. All product eligibility/configuration comes from D1. */
export async function resolveCheckoutItems(
  quantities: ReadonlyMap<string, number>,
  env: Partial<CheckoutEnvironment>,
): Promise<ResolvedCheckout> {
  if (!env.PROMO_DB) throw new Error('Missing database');
  const products = await getPurchasableProducts(env.PROMO_DB, [...quantities.keys()]);
  // A Stripe line must identify exactly one internal product for historical order snapshots.
  if (new Set(products.map(product => product.stripePriceId)).size !== products.length) {
    throw new Error('Ambiguous checkout configuration');
  }
  const items = products.map(product => ({ price: product.stripePriceId, quantity: quantities.get(product.id)! }));
  const totalBoxes = items.reduce((sum, item) => sum + item.quantity, 0);
  return { items, products, totalBoxes, shippingOptions: [checkoutShippingOption(totalBoxes)] };
}
