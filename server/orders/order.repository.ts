import type { NewPaidOrder } from './order.types.ts';
import type { PublicOrderSummary } from '../../src/shared/order-summary.ts';

export type PublicOrderRow = Omit<PublicOrderSummary, 'items'> & { itemsJson: string };

/** One read returns a consistent minimal snapshot; no customer/Stripe IDs are selected. */
export async function findPublicOrderBySession(db: OrderDatabase, sessionId: string): Promise<PublicOrderRow | null> {
  return db.prepare(`SELECT
    o.order_number AS orderNumber, o.payment_status AS paymentStatus,
    o.fulfillment_status AS fulfillmentStatus, o.total_amount AS totalAmount,
    o.currency, o.created_at AS createdAt,
    (SELECT json_group_array(json_object(
      'productName', i.product_name, 'quantity', i.quantity,
      'unitAmount', i.unit_amount, 'lineTotalAmount', i.line_total_amount
    )) FROM order_items i WHERE i.order_id = o.id) AS itemsJson
    FROM orders o WHERE o.stripe_checkout_session_id = ?1`)
    .bind(sessionId).first<PublicOrderRow>();
}

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

/** Minimal D1 contract for admin reads and conditional fulfillment writes. */
export interface AdminOrderDatabase {
  prepare(sql: string): {
    bind(...values: SqlValue[]): ReturnType<AdminOrderDatabase['prepare']>;
    first<T>(): Promise<T | null>;
    all<T>(): Promise<{ success: boolean; results: T[] }>;
  };
}
const ADMIN_ORDER_COLUMNS = `o.id, o.order_number AS orderNumber,
  o.payment_status AS paymentStatus, o.fulfillment_status AS fulfillmentStatus,
  o.total_amount AS totalAmount, o.currency, o.created_at AS createdAt, o.paid_at AS paidAt,
  o.customer_name AS customerName, o.customer_email AS customerEmail, o.customer_phone AS customerPhone,
  o.shipping_name AS shippingName, o.shipping_address_line1 AS shippingLine1,
  o.shipping_address_line2 AS shippingLine2, o.shipping_postal_code AS shippingPostalCode,
  o.shipping_city AS shippingCity, o.shipping_country AS shippingCountry,
  (SELECT json_group_array(json_object('productId', i.product_id,
    'productName', i.product_name, 'quantity', i.quantity, 'unitAmount', i.unit_amount,
    'lineTotalAmount', i.line_total_amount)) FROM order_items i WHERE i.order_id = o.id) AS itemsJson`;
export async function findAdminOrderById(db: AdminOrderDatabase, id: string): Promise<unknown | null> {
  return db.prepare(`SELECT ${ADMIN_ORDER_COLUMNS} FROM orders o WHERE o.id = ?1`).bind(id).first<unknown>();
}
export async function updateOrderFulfillment(db: AdminOrderDatabase, id: string,
  previous: PublicOrderSummary['fulfillmentStatus'], next: PublicOrderSummary['fulfillmentStatus']): Promise<boolean> {
  // A stale/concurrent request cannot overwrite a newer state. No other order column is written.
  return await db.prepare('UPDATE orders SET fulfillment_status=?1 WHERE id=?2 AND fulfillment_status=?3 RETURNING id')
    .bind(next, id, previous).first<{ id: string }>() !== null;
}
export async function findAdminOrders(db: AdminOrderDatabase, limit: number,
  cursor: { createdAt: string; id: string } | null): Promise<unknown[]> {
  const where = cursor ? 'WHERE (o.created_at < ?1 OR (o.created_at = ?1 AND o.id < ?2))' : '';
  const statement = db.prepare(`SELECT ${ADMIN_ORDER_COLUMNS} FROM orders o ${where}
    ORDER BY o.created_at DESC, o.id DESC LIMIT ${cursor ? '?3' : '?1'}`);
  const result = await (cursor ? statement.bind(cursor.createdAt, cursor.id, limit) : statement.bind(limit)).all<unknown>();
  if (!result.success || !Array.isArray(result.results)) throw new Error('Order query failed');
  return result.results;
}
