import type { PublicOrderSummary, PublicOrderItem } from '../../shared/order-summary';

/** Protected admin API contract. Never persist this customer data in browser storage. */
export interface AdminOrder extends Omit<PublicOrderSummary, 'items'> {
  readonly id: string;
  readonly paidAt: string;
  readonly customer: { readonly name: string; readonly email: string; readonly phone: string | null };
  readonly shippingAddress: { readonly name: string; readonly line1: string; readonly line2: string | null;
    readonly postalCode: string; readonly city: string; readonly country: string };
  readonly items: readonly (PublicOrderItem & { readonly productId: string })[];
}
export interface AdminOrderPage {
  readonly items: readonly AdminOrder[];
  readonly nextCursor: string | null;
}
