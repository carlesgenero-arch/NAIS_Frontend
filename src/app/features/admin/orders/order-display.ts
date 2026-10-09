import { Pipe, type PipeTransform } from '@angular/core';
import type { AdminOrder } from '../../../models/admin-order.interface';

export const PAYMENT_LABELS: Record<AdminOrder['paymentStatus'], string> = {
  paid: 'Pagat', partially_refunded: 'Reemborsat parcialment', refunded: 'Reemborsat',
};
export const FULFILLMENT_LABELS: Record<AdminOrder['fulfillmentStatus'], string> = {
  pending: 'Pendent', preparing: 'En preparació', shipped: 'Enviat', delivered: 'Lliurat', cancelled: 'Cancel·lat',
};
@Pipe({ name: 'orderEuro' })
export class OrderEuroPipe implements PipeTransform {
  transform(cents: number): string {
    if (!Number.isSafeInteger(cents) || cents < 0) return '—';
    const amount = BigInt(cents);
    return `${(amount / 100n).toLocaleString('ca-ES')},${(amount % 100n).toString().padStart(2, '0')} €`;
  }
}
