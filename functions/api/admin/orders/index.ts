import { adminRead, type AdminReadContext } from '../../../../server/admin/admin-read.ts';
import { listAdminOrders } from '../../../../server/orders/admin-order.service.ts';
export const onRequest = (context: AdminReadContext): Promise<Response> => adminRead(context,
  db => listAdminOrders(db, new URL(context.request.url).searchParams));
