import { Router } from 'express';
import { expenseController } from './expense.controller';
import {
  approveExpenseSchema,
  createExpenseSchema,
  disburseExpenseSchema,
  expenseIdParam,
  listExpenseQuerySchema,
  rejectExpenseSchema,
  summaryQuerySchema,
  updateExpenseSchema,
  voidExpenseSchema,
} from './expense.schema';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { PERMISSIONS } from '../../config';

export const expenseRoutes = Router();

// The expense ledger names payees and internal decisions, so unlike mutual-aid
// contributions it is not member-facing: leaders and treasurers only.
expenseRoutes.use(authenticate, authorize(...PERMISSIONS.ASSOCIATION_REPORTS));

expenseRoutes.get(
  '/',
  validate({ query: listExpenseQuerySchema }),
  asyncHandler(expenseController.list),
);

// Declared before /:id so "summary" is not parsed as an expense id.
expenseRoutes.get(
  '/summary',
  validate({ query: summaryQuerySchema }),
  asyncHandler(expenseController.summary),
);

expenseRoutes.get(
  '/:id',
  validate({ params: expenseIdParam }),
  asyncHandler(expenseController.getById),
);

// Either staff role may raise a request; the service blocks self-approval.
expenseRoutes.post(
  '/',
  validate({ body: createExpenseSchema }),
  asyncHandler(expenseController.create),
);

expenseRoutes.patch(
  '/:id',
  validate({ params: expenseIdParam, body: updateExpenseSchema }),
  asyncHandler(expenseController.update),
);

expenseRoutes.post(
  '/:id/submit',
  validate({ params: expenseIdParam }),
  asyncHandler(expenseController.submit),
);

// A leader signs off the spend...
expenseRoutes.post(
  '/:id/approve',
  authorize(...PERMISSIONS.EXPENSE_APPROVAL),
  validate({ params: expenseIdParam, body: approveExpenseSchema }),
  asyncHandler(expenseController.approve),
);

expenseRoutes.post(
  '/:id/reject',
  authorize(...PERMISSIONS.EXPENSE_APPROVAL),
  validate({ params: expenseIdParam, body: rejectExpenseSchema }),
  asyncHandler(expenseController.reject),
);

// ...and the treasurer pays it out.
expenseRoutes.post(
  '/:id/disburse',
  authorize(...PERMISSIONS.EXPENSE_DISBURSEMENT),
  validate({ params: expenseIdParam, body: disburseExpenseSchema }),
  asyncHandler(expenseController.disburse),
);

expenseRoutes.post(
  '/:id/void',
  authorize(...PERMISSIONS.EXPENSE_APPROVAL),
  validate({ params: expenseIdParam, body: voidExpenseSchema }),
  asyncHandler(expenseController.void),
);

expenseRoutes.delete(
  '/:id',
  validate({ params: expenseIdParam }),
  asyncHandler(expenseController.remove),
);
