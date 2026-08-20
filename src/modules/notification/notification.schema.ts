import { z } from 'zod';
import { paginationSchema } from '../../utils/validators';

export const listNotificationQuerySchema = paginationSchema.extend({
  unreadOnly: z.coerce.boolean().optional(),
});

export const notificationIdParam = z.object({ id: z.string().uuid() });

export type ListNotificationQuery = z.infer<typeof listNotificationQuerySchema>;
