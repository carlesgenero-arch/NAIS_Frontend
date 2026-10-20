import { Pipe, type PipeTransform } from '@angular/core';
import type { AdminOrder } from '../../../models/admin-order.interface';

export type OrderStatus = AdminOrder['paymentStatus'] | AdminOrder['fulfillmentStatus'];
export const ORDER_STATUS_LABEL_KEYS = {
  paid: 'admin.order.status.paid', partially_refunded: 'admin.order.status.partially_refunded',
  refunded: 'admin.order.status.refunded', pending: 'admin.order.status.pending',
  preparing: 'admin.order.status.preparing', shipped: 'admin.order.status.shipped',
  delivered: 'admin.order.status.delivered', cancelled: 'admin.order.status.cancelled',
} as const;
@Pipe({ name: 'orderEuro' })
export class OrderEuroPipe implements PipeTransform {
  transform(cents: number): string {
    if (!Number.isSafeInteger(cents) || cents < 0) return '—';
    const amount = BigInt(cents);
    return `${(amount / 100n).toLocaleString('ca-ES')},${(amount % 100n).toString().padStart(2, '0')} €`;
  }
}
