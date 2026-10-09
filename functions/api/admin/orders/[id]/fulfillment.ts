import { adminOrderFulfillment } from '../../../../../server/admin/admin-order-fulfillment.ts';
import type { AdminReadContext } from '../../../../../server/admin/admin-read.ts';

export const onRequest = (context: AdminReadContext): Promise<Response> => adminOrderFulfillment(context);
