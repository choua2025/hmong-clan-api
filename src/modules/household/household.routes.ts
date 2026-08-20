import { Router } from 'express';
import { householdController } from './household.controller';
import {
  createHouseholdSchema,
  householdIdParam,
  listHouseholdQuerySchema,
  updateHouseholdSchema,
} from './household.schema';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { PERMISSIONS } from '../../config';
export const householdRoutes = Router();

// All household routes require authentication.
householdRoutes.use(authenticate);

householdRoutes.get(
  '/',
  validate({ query: listHouseholdQuerySchema }),
  asyncHandler(householdController.list),
);

householdRoutes.get(
  '/:id',
  validate({ params: householdIdParam }),
  asyncHandler(householdController.getById),
);

// Leaders (and super admins) manage households.
householdRoutes.post(
  '/',
  authorize(...PERMISSIONS.HOUSEHOLD_MANAGEMENT),
  validate({ body: createHouseholdSchema }),
  asyncHandler(householdController.create),
);

householdRoutes.patch(
  '/:id',
  authorize(...PERMISSIONS.HOUSEHOLD_MANAGEMENT),
  validate({ params: householdIdParam, body: updateHouseholdSchema }),
  asyncHandler(householdController.update),
);

householdRoutes.delete(
  '/:id',
  authorize(...PERMISSIONS.HOUSEHOLD_MANAGEMENT),
  validate({ params: householdIdParam }),
  asyncHandler(householdController.remove),
);
