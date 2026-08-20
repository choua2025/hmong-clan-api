import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { notificationController } from './notification.controller';
import { listNotificationQuerySchema, notificationIdParam } from './notification.schema';

export const notificationRoutes = Router();

notificationRoutes.use(authenticate);

notificationRoutes.get(
  '/',
  validate({ query: listNotificationQuerySchema }),
  asyncHandler(notificationController.list),
);

notificationRoutes.get('/unread-count', asyncHandler(notificationController.unreadCount));

notificationRoutes.post(
  '/:id/read',
  validate({ params: notificationIdParam }),
  asyncHandler(notificationController.markRead),
);

notificationRoutes.post('/read-all', asyncHandler(notificationController.markAllRead));
