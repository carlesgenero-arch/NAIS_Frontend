export { MAX_CART_QUANTITY } from '../../shared/cart-limits';

/** The only fields persisted or included in a future checkout request. */
export interface CartEntry {
  readonly productId: string;
  readonly quantity: number;
}
