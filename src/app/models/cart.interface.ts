/** UI limit in packs, not a guarantee of available stock. */
export const MAX_CART_QUANTITY = 24;

/** The only fields persisted or included in a future checkout request. */
export interface CartEntry {
  readonly productId: string;
  readonly quantity: number;
}
