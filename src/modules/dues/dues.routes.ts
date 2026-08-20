import { Router } from 'express';
import { duesController } from './dues.controller';
import {
  confirmDuesSchema,
  createDuesSchema,
  duesIdParam,
  listDuesQuerySchema,
  payDuesSchema,
  rejectDuesSchema,
} from './dues.schema';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { PERMISSIONS } from '../../config';
export const duesRoutes = Router();

duesRoutes.use(authenticate);

duesRoutes.get('/', validate({ query: listDuesQuerySchema }), asyncHandler(duesController.list));
duesRoutes.get('/:id', validate({ params: duesIdParam }), asyncHandler(duesController.getById));

// Charging dues: treasurer (or super admin via authorize override).
duesRoutes.post(
  '/',
  authorize(...PERMISSIONS.DUES_MANAGEMENT),
  validate({ body: createDuesSchema }),
  asyncHandler(duesController.create),
);

// Submitting a transfer slip: the household member (or staff on their behalf).
// Household-level access is enforced in the service.
duesRoutes.post(
  '/:id/pay',
  validate({ params: duesIdParam, body: payDuesSchema }),
  asyncHandler(duesController.submitPayment),
);

// Confirming / rejecting money is a treasurer responsibility (claude.md §5).
duesRoutes.post(
  '/:id/confirm',
  authorize(...PERMISSIONS.PAYMENT_CONFIRMATION),
  validate({ params: duesIdParam, body: confirmDuesSchema }),
  asyncHandler(duesController.confirmPayment),
);

duesRoutes.post(
  '/:id/reject',
  authorize(...PERMISSIONS.PAYMENT_CONFIRMATION),
  validate({ params: duesIdParam, body: rejectDuesSchema }),
  asyncHandler(duesController.rejectPayment),
);
