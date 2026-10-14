/** Public threshold shared by cart messaging and authoritative server shipping calculation. */
export const FREE_SHIPPING_MIN_BOXES = 2;
export const SHIPPING_PRICE_EUR = 6;

/** Amount in integer cents; an empty display cart has no shipping charge. */
export function shippingAmountCents(totalBoxes: number): number {
  if (!Number.isSafeInteger(totalBoxes) || totalBoxes < 0) throw new Error('Invalid box count');
  return totalBoxes === 0 || totalBoxes >= FREE_SHIPPING_MIN_BOXES ? 0 : SHIPPING_PRICE_EUR * 100;
}
