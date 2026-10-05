import type { NewPaidOrder } from './order.types.ts';

type SqlValue = string | number | null;
interface OrderStatement {
  bind(...values: SqlValue[]): OrderStatement;
  first<T>(): Promise<T | null>;
}
export interface OrderDatabase {
  prepare(sql: string): OrderStatement;
  batch(statements: OrderStatement[]): Promise<{ success: boolean }[]>;
}

export async function findOrderBySession(db: OrderDatabase, sessionId: string): Promise<{ id: string } | null> {
  return db.prepare('SELECT id FROM orders WHERE stripe_checkout_session_id = ?1')
    .bind(sessionId).first<{ id: string }>();
}

export async function insertPaidOrder(db: OrderDatabase, order: NewPaidOrder): Promise<void> {
  const columns = [
    'id', 'order_number', 'stripe_checkout_session_id', 'stripe_event_id', 'stripe_payment_intent_id',
    'stripe_customer_id', 'customer_name', 'customer_email', 'customer_phone', 'shipping_name',
    'shipping_address_line1', 'shipping_address_line2', 'shipping_postal_code', 'shipping_city', 'shipping_country',
    'subtotal_amount', 'shipping_amount', 'discount_amount', 'tax_amount', 'total_amount', 'currency',
    'payment_status', 'fulfillment_status', 'paid_at',
  ] as const;
  const values: SqlValue[] = columns.map(column => order[column]);
  const statements = [db.prepare(`INSERT INTO orders (${columns.join(',')}) VALUES (${values.map(() => '?').join(',')}) ON CONFLICT(stripe_checkout_session_id) DO NOTHING`).bind(...values)];
  for (const item of order.items) {
    statements.push(db.prepare(`INSERT INTO order_items
      (id, order_id, stripe_line_item_id, product_id, product_name, stripe_price_id, quantity, unit_amount, line_total_amount)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9 WHERE EXISTS (SELECT 1 FROM orders WHERE id = ?2)`)
      .bind(crypto.randomUUID(), order.id, item.stripe_line_item_id, item.product_id, item.product_name,
        item.stripe_price_id, item.quantity, item.unit_amount, item.line_total_amount));
  }
  // D1 batch is transactional. A racing duplicate inserts neither parent nor children.
  const results = await db.batch(statements);
  if (results.length !== statements.length || results.some(result => !result.success)) throw new Error('Persistence failed');
}
