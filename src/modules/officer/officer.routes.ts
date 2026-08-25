import { Router } from 'express';
import { officerController } from './officer.controller';
import {
  createOfficeTermSchema,
  endOfficeTermSchema,
  listOfficeTermQuerySchema,
  officeTermIdParam,
  updateOfficeTermSchema,
} from './officer.schema';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { PERMISSIONS } from '../../config';

export const officerRoutes = Router();

// Who leads the association is visible to every member — transparency first.
officerRoutes.use(authenticate);

officerRoutes.get(
  '/',
  validate({ query: listOfficeTermQuerySchema }),
  asyncHandler(officerController.list),
);

// Declared before /:id so "board" is not parsed as a term id.
officerRoutes.get('/board', asyncHandler(officerController.board));

officerRoutes.get(
  '/:id',
  validate({ params: officeTermIdParam }),
  asyncHandler(officerController.getById),
);

// Appointments are a leadership decision.
officerRoutes.post(
  '/',
  authorize(...PERMISSIONS.OFFICER_MANAGEMENT),
  validate({ body: createOfficeTermSchema }),
  asyncHandler(officerController.create),
);

officerRoutes.patch(
  '/:id',
  authorize(...PERMISSIONS.OFFICER_MANAGEMENT),
  validate({ params: officeTermIdParam, body: updateOfficeTermSchema }),
  asyncHandler(officerController.update),
);

officerRoutes.post(
  '/:id/end',
  authorize(...PERMISSIONS.OFFICER_MANAGEMENT),
  validate({ params: officeTermIdParam, body: endOfficeTermSchema }),
  asyncHandler(officerController.end),
);

officerRoutes.delete(
  '/:id',
  authorize(...PERMISSIONS.OFFICER_MANAGEMENT),
  validate({ params: officeTermIdParam }),
  asyncHandler(officerController.remove),
);
