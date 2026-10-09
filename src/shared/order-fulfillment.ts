import type { PublicOrderSummary } from './order-summary';

export type FulfillmentStatus = PublicOrderSummary['fulfillmentStatus'];
/** Shared display policy; the backend independently enforces these transitions against D1. */
export const FULFILLMENT_TRANSITIONS: Readonly<Record<FulfillmentStatus, readonly FulfillmentStatus[]>> = {
  pending: ['preparing', 'cancelled'],
  preparing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};
