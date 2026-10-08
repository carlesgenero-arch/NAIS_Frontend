import { adminRead, type AdminReadContext } from '../../../../server/admin/admin-read.ts';
import { getAdminOrder, isOrderId, InvalidAdminOrderQuery } from '../../../../server/orders/admin-order.service.ts';
export const onRequest = (context: AdminReadContext): Promise<Response> => adminRead(context, db => {
  const id = context.params?.id;
  if (!isOrderId(id)) throw new InvalidAdminOrderQuery();
  return getAdminOrder(db, id);
});
