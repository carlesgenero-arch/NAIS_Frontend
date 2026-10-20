import { adminOrderArchive } from '../../../../../server/admin/admin-order-archive.ts';
import type { AdminReadContext } from '../../../../../server/admin/admin-read.ts';
export const onRequest = (context: AdminReadContext): Promise<Response> => adminOrderArchive(context, true);
