import { isPublicOrderSummary } from '../../src/shared/order-summary.ts';
import { findAdminOrderById, findAdminOrders, type AdminOrderDatabase } from './order.repository.ts';
import type { AdminOrder, AdminOrderPage } from './admin-order.types.ts';

export class InvalidAdminOrderQuery extends Error {}
export function isOrderId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
}
function timestamp(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value));
}
function readOrder(value: unknown): AdminOrder {
  if (!value || typeof value !== 'object') throw new Error('Invalid order data');
  const row = value as Record<string, unknown>;
  const parsed: unknown = JSON.parse(typeof row['itemsJson'] === 'string' ? row['itemsJson'] : 'null');
  const summary: unknown = { orderNumber: row['orderNumber'], paymentStatus: row['paymentStatus'],
    fulfillmentStatus: row['fulfillmentStatus'], totalAmount: row['totalAmount'], currency: row['currency'],
    createdAt: row['createdAt'], items: parsed };
  if (!isPublicOrderSummary(summary) || !isOrderId(row['id']) || !timestamp(row['createdAt']) || !timestamp(row['paidAt'])) {
    throw new Error('Invalid order data');
  }
  const text = (key: string): string => {
    const value = row[key];
    if (typeof value !== 'string' || !value.trim()) throw new Error('Invalid order data');
    return value;
  };
  const nullable = (key: string): string | null => {
    const value = row[key];
    if (value !== null && typeof value !== 'string') throw new Error('Invalid order data');
    return value;
  };
  const items = (parsed as Record<string, unknown>[]).map((item, index) => {
    if (typeof item['productId'] !== 'string' || !item['productId']) throw new Error('Invalid order data');
    const checked = summary.items[index]!;
    return { productId: item['productId'], productName: checked.productName, quantity: checked.quantity,
      unitAmount: checked.unitAmount, lineTotalAmount: checked.lineTotalAmount };
  });
  return { id: row['id'], orderNumber: summary.orderNumber, paymentStatus: summary.paymentStatus,
    fulfillmentStatus: summary.fulfillmentStatus, totalAmount: summary.totalAmount, currency: summary.currency,
    createdAt: row['createdAt'], paidAt: row['paidAt'], items,
    customer: { name: text('customerName'), email: text('customerEmail'), phone: nullable('customerPhone') },
    shippingAddress: { name: text('shippingName'), line1: text('shippingLine1'), line2: nullable('shippingLine2'),
      postalCode: text('shippingPostalCode'), city: text('shippingCity'), country: text('shippingCountry') } };
}
export async function getAdminOrder(db: AdminOrderDatabase, id: string): Promise<AdminOrder | null> {
  if (!isOrderId(id)) throw new InvalidAdminOrderQuery();
  const row = await findAdminOrderById(db, id);
  return row === null ? null : readOrder(row);
}
export async function listAdminOrders(db: AdminOrderDatabase, params: URLSearchParams): Promise<AdminOrderPage> {
  let unknownParameter = false;
  params.forEach((_, key) => { if (!['limit', 'cursor'].includes(key)) unknownParameter = true; });
  if (unknownParameter
    || params.getAll('limit').length > 1 || params.getAll('cursor').length > 1) throw new InvalidAdminOrderQuery();
  const rawLimit = params.get('limit') ?? '25';
  if (!/^[1-9]\d{0,2}$/.test(rawLimit) || Number(rawLimit) > 100) throw new InvalidAdminOrderQuery();
  const limit = Number(rawLimit);
  let cursor: { createdAt: string; id: string } | null = null;
  if (params.has('cursor')) {
    try {
      const raw = params.get('cursor')!;
      if (!raw || raw.length > 256) throw new Error();
      const value: unknown = JSON.parse(atob(raw));
      if (!Array.isArray(value) || value.length !== 2 || !timestamp(value[0]) || !isOrderId(value[1])) throw new Error();
      cursor = { createdAt: value[0], id: value[1] };
    } catch { throw new InvalidAdminOrderQuery(); }
  }
  const rows = (await findAdminOrders(db, limit + 1, cursor)).map(readOrder);
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return { items, nextCursor: rows.length > limit && last ? btoa(JSON.stringify([last.createdAt, last.id])) : null };
}
