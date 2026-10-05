/** Internal snapshots only: constructed from verified, authoritative Stripe data. */
export interface OrderItemSnapshot {
  readonly stripe_line_item_id: string;
  readonly product_id: string;
  readonly product_name: string;
  readonly stripe_price_id: string;
  readonly quantity: number;
  readonly unit_amount: number;
  readonly line_total_amount: number;
}

export interface PaidOrderSnapshot {
  readonly stripe_checkout_session_id: string;
  readonly stripe_event_id: string;
  readonly stripe_payment_intent_id: string;
  readonly stripe_customer_id: string | null;
  readonly customer_name: string;
  readonly customer_email: string;
  readonly customer_phone: string | null;
  readonly shipping_name: string;
  readonly shipping_address_line1: string;
  readonly shipping_address_line2: string | null;
  readonly shipping_postal_code: string;
  readonly shipping_city: string;
  readonly shipping_country: string;
  readonly subtotal_amount: number;
  readonly shipping_amount: number;
  readonly discount_amount: number;
  readonly tax_amount: number;
  readonly total_amount: number;
  readonly currency: string;
  readonly paid_at: string;
  readonly items: readonly OrderItemSnapshot[];
}

export interface NewPaidOrder extends PaidOrderSnapshot {
  readonly id: string;
  readonly order_number: string;
  readonly payment_status: 'paid';
  readonly fulfillment_status: 'pending';
}
