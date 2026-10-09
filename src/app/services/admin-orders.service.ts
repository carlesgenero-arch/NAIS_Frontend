import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { map, type Observable } from 'rxjs';
import { isPublicOrderSummary } from '../../shared/order-summary';
import type { AdminOrder, AdminOrderPage } from '../models/admin-order.interface';
import type { FulfillmentStatus } from '../../shared/order-fulfillment';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid admin order');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Invalid admin order');
  return value;
}
function nullable(value: unknown): string | null {
  if (value === null || typeof value === 'string') return value;
  throw new Error('Invalid admin order');
}
function readOrder(value: unknown): AdminOrder {
  const row = record(value);
  if (!isPublicOrderSummary(value) || value.currency !== 'eur') throw new Error('Invalid admin order');
  const id = text(row['id']); const paidAt = text(row['paidAt']);
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id) || !Number.isFinite(Date.parse(paidAt))) throw new Error('Invalid admin order');
  const customer = record(row['customer']); const address = record(row['shippingAddress']);
  return { id, paidAt, orderNumber: value.orderNumber, createdAt: value.createdAt,
    paymentStatus: value.paymentStatus, fulfillmentStatus: value.fulfillmentStatus,
    totalAmount: value.totalAmount, currency: value.currency,
    customer: { name: text(customer['name']), email: text(customer['email']), phone: nullable(customer['phone']) },
    shippingAddress: { name: text(address['name']), line1: text(address['line1']), line2: nullable(address['line2']),
      postalCode: text(address['postalCode']), city: text(address['city']), country: text(address['country']) },
    items: value.items.map(item => ({ productId: text(record(item)['productId']), productName: item.productName,
      quantity: item.quantity, unitAmount: item.unitAmount, lineTotalAmount: item.lineTotalAmount })) };
}
export function adminOrderError(error: unknown): string {
  if (error instanceof HttpErrorResponse && [401, 403].includes(error.status)) return 'No tens accés o la sessió ha caducat. Torna a identificar-te.';
  return 'No hem pogut carregar les comandes. Torna-ho a provar.';
}
export function fulfillmentError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if ([401, 403].includes(error.status)) return adminOrderError(error);
    if (error.status === 409) return 'La comanda ha canviat o la transició no està permesa. Torna a carregar-la abans de continuar.';
    if (error.status === 404) return 'No s’ha trobat la comanda.';
    if (error.status === 400) return 'El canvi d’estat no és vàlid.';
  }
  return 'No podem confirmar el canvi. Torna a carregar la comanda per comprovar-ne l’estat.';
}
@Injectable({ providedIn: 'root' })
export class AdminOrdersService {
  private readonly http = inject(HttpClient);
  list(cursor: string | null = null, limit = 25): Observable<AdminOrderPage> {
    let params = new HttpParams().set('limit', limit);
    if (cursor) params = params.set('cursor', cursor);
    return this.http.get<unknown>('/api/admin/orders', { params }).pipe(map(value => {
      const row = record(value); const cursor = row['nextCursor'];
      if (!Array.isArray(row['items']) || (cursor !== null && (typeof cursor !== 'string' || !cursor || cursor.length > 256))) throw new Error('Invalid admin orders');
      return { items: row['items'].map(readOrder), nextCursor: cursor };
    }));
  }
  getOrder(id: string): Observable<AdminOrder> {
    return this.http.get<unknown>('/api/admin/orders/' + encodeURIComponent(id)).pipe(map(readOrder));
  }
  updateFulfillment(id: string, fulfillmentStatus: FulfillmentStatus): Observable<AdminOrder> {
    return this.http.patch<unknown>('/api/admin/orders/' + encodeURIComponent(id) + '/fulfillment',
      { fulfillmentStatus }).pipe(map(readOrder));
  }
}
