import { Router } from 'express';
import { assetController } from './asset.controller';
import {
  approveLoanSchema,
  assetIdParam,
  checkoutLoanSchema,
  createAssetSchema,
  createLoanSchema,
  listAssetQuerySchema,
  listLoanQuerySchema,
  loanIdParam,
  markLostLoanSchema,
  returnLoanSchema,
  updateAssetSchema,
} from './asset.schema';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { PERMISSIONS } from '../../config';

export const assetRoutes = Router();

// Shared clan property is visible to every member — they need to know what
// they can borrow. Loan lists are scoped to the caller's household in the
// service; staff see all of them.
assetRoutes.use(authenticate);

// ── Loans ────────────────────────────────────────────────────
// Declared before "/:id" so "loans" is never parsed as an asset id.

assetRoutes.get(
  '/loans',
  validate({ query: listLoanQuerySchema }),
  asyncHandler(assetController.listLoans),
);

assetRoutes.get(
  '/loans/:loanId',
  validate({ params: loanIdParam }),
  asyncHandler(assetController.getLoanById),
);

assetRoutes.post(
  '/loans/:loanId/approve',
  authorize(...PERMISSIONS.ASSET_LOAN_APPROVAL),
  validate({ params: loanIdParam, body: approveLoanSchema }),
  asyncHandler(assetController.approveLoan),
);

assetRoutes.post(
  '/loans/:loanId/checkout',
  authorize(...PERMISSIONS.ASSET_LOAN_APPROVAL),
  validate({ params: loanIdParam, body: checkoutLoanSchema }),
  asyncHandler(assetController.checkoutLoan),
);

assetRoutes.post(
  '/loans/:loanId/return',
  authorize(...PERMISSIONS.ASSET_LOAN_APPROVAL),
  validate({ params: loanIdParam, body: returnLoanSchema }),
  asyncHandler(assetController.returnLoan),
);

assetRoutes.post(
  '/loans/:loanId/lost',
  authorize(...PERMISSIONS.ASSET_MANAGEMENT),
  validate({ params: loanIdParam, body: markLostLoanSchema }),
  asyncHandler(assetController.markLost),
);

// A member may withdraw their own request; staff may cancel any (enforced
// in the service by household scope).
assetRoutes.delete(
  '/loans/:loanId',
  validate({ params: loanIdParam }),
  asyncHandler(assetController.cancelLoan),
);

// ── Register ─────────────────────────────────────────────────

assetRoutes.get(
  '/',
  validate({ query: listAssetQuerySchema }),
  asyncHandler(assetController.list),
);

assetRoutes.get(
  '/:id',
  validate({ params: assetIdParam }),
  asyncHandler(assetController.getById),
);

assetRoutes.get(
  '/:id/loans',
  validate({ params: assetIdParam, query: listLoanQuerySchema }),
  asyncHandler(assetController.listLoansForAsset),
);

// Any authenticated member may ask to borrow.
assetRoutes.post(
  '/:id/loans',
  validate({ params: assetIdParam, body: createLoanSchema }),
  asyncHandler(assetController.requestLoan),
);

// Leaders own the register itself.
assetRoutes.post(
  '/',
  authorize(...PERMISSIONS.ASSET_MANAGEMENT),
  validate({ body: createAssetSchema }),
  asyncHandler(assetController.create),
);

assetRoutes.patch(
  '/:id',
  authorize(...PERMISSIONS.ASSET_MANAGEMENT),
  validate({ params: assetIdParam, body: updateAssetSchema }),
  asyncHandler(assetController.update),
);

assetRoutes.delete(
  '/:id',
  authorize(...PERMISSIONS.ASSET_MANAGEMENT),
  validate({ params: assetIdParam }),
  asyncHandler(assetController.remove),
);
