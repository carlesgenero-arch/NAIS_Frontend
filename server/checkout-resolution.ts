import { resolveCheckoutPrice, type CheckoutProductId } from './checkout-catalogue.ts';
import type { CheckoutPriceBindings } from './checkout-env.ts';
import { checkoutShippingOption } from './checkout-rules.ts';

/** Server-only result; Price IDs must never be serialized to the browser. */
export interface ResolvedCheckout {
  readonly items: readonly { readonly price: string; readonly quantity: number }[];
  readonly totalBoxes: number;
  readonly shippingOptions: readonly [ReturnType<typeof checkoutShippingOption>];
}

/** Receives the validated, merged quantities from checkout-validation. */
export function resolveCheckoutItems(
  quantities: ReadonlyMap<CheckoutProductId, number>,
  env: Partial<CheckoutPriceBindings>,
): ResolvedCheckout {
  const items: { price: string; quantity: number }[] = [];
  let totalBoxes = 0;
  for (const [productId, quantity] of quantities) {
    const price = resolveCheckoutPrice(productId, env);
    if (!price) throw new Error('Checkout product unavailable');
    items.push({ price, quantity });
    totalBoxes += quantity;
  }
  // Exactly one server-selected native rate; the browser cannot choose free shipping.
  return { items, totalBoxes, shippingOptions: [checkoutShippingOption(totalBoxes)] };
}
