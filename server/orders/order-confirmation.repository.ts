import type { OrderDatabase } from './order.repository.ts';
import type { NewPaidOrder } from './order.types.ts';

export type ConfirmationSnapshot = Pick<NewPaidOrder, 'order_number' | 'customer_name' | 'customer_email'
  | 'shipping_name' | 'shipping_address_line1' | 'shipping_address_line2' | 'shipping_postal_code'
  | 'shipping_city' | 'shipping_country' | 'subtotal_amount' | 'shipping_amount' | 'discount_amount'
  | 'tax_amount' | 'total_amount' | 'currency'> & { itemsJson: string };

export async function claimConfirmation(db: OrderDatabase, session: string): Promise<boolean> {
  return await db.prepare(`UPDATE orders SET confirmation_email_status='sending'
    WHERE stripe_checkout_session_id=?1 AND payment_status='paid'
    AND confirmation_email_status='pending' RETURNING id`).bind(session).first() !== null;
}
export async function readConfirmation(db: OrderDatabase, session: string): Promise<ConfirmationSnapshot | null> {
  return db.prepare(`SELECT order_number, customer_name, customer_email, shipping_name,
    shipping_address_line1, shipping_address_line2, shipping_postal_code, shipping_city, shipping_country,
    subtotal_amount, shipping_amount, discount_amount, tax_amount, total_amount, currency,
    (SELECT json_group_array(json_object('name',product_name,'quantity',quantity,
      'unit',unit_amount,'total',line_total_amount)) FROM order_items WHERE order_id=o.id) AS itemsJson
    FROM orders o WHERE stripe_checkout_session_id=?1 AND payment_status='paid'`)
    .bind(session).first<ConfirmationSnapshot>();
}
export async function finishConfirmation(db: OrderDatabase, session: string, status: 'sent' | 'failed'): Promise<void> {
  await db.prepare(`UPDATE orders SET confirmation_email_status=?2, confirmation_email_sent_at=?3
    WHERE stripe_checkout_session_id=?1 AND confirmation_email_status='sending' RETURNING id`)
    .bind(session, status, status === 'sent' ? new Date().toISOString() : null).first();
}
