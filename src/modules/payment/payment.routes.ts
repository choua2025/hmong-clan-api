import { Router } from 'express';
import { paymentController } from './payment.controller';
import {
  confirmPaymentSchema,
  listPaymentQuerySchema,
  paymentIdParam,
  rejectPaymentSchema,
} from './payment.schema';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { PERMISSIONS } from '../../config';
export const paymentRoutes = Router();

// Finance payments are visible to treasurers (and super admins).
paymentRoutes.use(authenticate, authorize(...PERMISSIONS.FINANCE_REPORTS));

paymentRoutes.get(
  '/',
  validate({ query: listPaymentQuerySchema }),
  asyncHandler(paymentController.list),
);

paymentRoutes.get(
  '/:id',
  validate({ params: paymentIdParam }),
  asyncHandler(paymentController.getById),
);

// Confirming/rejecting money is strictly a treasurer responsibility.
paymentRoutes.post(
  '/:id/confirm',
  authorize(...PERMISSIONS.PAYMENT_CONFIRMATION),
  validate({ params: paymentIdParam, body: confirmPaymentSchema }),
  asyncHandler(paymentController.confirm),
);

paymentRoutes.post(
  '/:id/reject',
  authorize(...PERMISSIONS.PAYMENT_CONFIRMATION),
  validate({ params: paymentIdParam, body: rejectPaymentSchema }),
  asyncHandler(paymentController.reject),
);
