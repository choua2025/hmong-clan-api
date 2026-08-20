import { Router } from 'express';
import { announcementController } from './announcement.controller';
import {
  announcementIdParam,
  createAnnouncementSchema,
  listAnnouncementQuerySchema,
  updateAnnouncementSchema,
} from './announcement.schema';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { PERMISSIONS } from '../../config';

export const announcementRoutes = Router();

announcementRoutes.use(authenticate);

announcementRoutes.get(
  '/',
  validate({ query: listAnnouncementQuerySchema }),
  asyncHandler(announcementController.list),
);

announcementRoutes.get(
  '/:id',
  validate({ params: announcementIdParam }),
  asyncHandler(announcementController.getById),
);

// Leaders author and manage announcements.
announcementRoutes.post(
  '/',
  authorize(...PERMISSIONS.ANNOUNCEMENT_MANAGEMENT),
  validate({ body: createAnnouncementSchema }),
  asyncHandler(announcementController.create),
);

announcementRoutes.patch(
  '/:id',
  authorize(...PERMISSIONS.ANNOUNCEMENT_MANAGEMENT),
  validate({ params: announcementIdParam, body: updateAnnouncementSchema }),
  asyncHandler(announcementController.update),
);

announcementRoutes.delete(
  '/:id',
  authorize(...PERMISSIONS.ANNOUNCEMENT_MANAGEMENT),
  validate({ params: announcementIdParam }),
  asyncHandler(announcementController.remove),
);
