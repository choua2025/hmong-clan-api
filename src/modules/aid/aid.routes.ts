import { Router } from 'express';
import { aidController } from './aid.controller';
import {
  aidCaseIdParam,
  contributeSchema,
  createAidCaseSchema,
  listAidCaseQuerySchema,
} from './aid.schema';
import { authenticate, authorize, requireLinkedMember } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { PERMISSIONS } from '../../config';

export const aidRoutes = Router();

// Mutual aid is transparent: any authenticated member can view cases & givers.
aidRoutes.use(authenticate);

aidRoutes.get(
  '/',
  validate({ query: listAidCaseQuerySchema }),
  asyncHandler(aidController.list),
);

aidRoutes.get(
  '/:id',
  validate({ params: aidCaseIdParam }),
  asyncHandler(aidController.getById),
);

// Leaders open and close cases.
aidRoutes.post(
  '/',
  authorize(...PERMISSIONS.MUTUAL_AID_CASE_MANAGEMENT),
  validate({ body: createAidCaseSchema }),
  asyncHandler(aidController.create),
);

aidRoutes.post(
  '/:id/close',
  authorize(...PERMISSIONS.MUTUAL_AID_CASE_MANAGEMENT),
  validate({ params: aidCaseIdParam }),
  asyncHandler(aidController.close),
);

// Any authenticated user may contribute (members as themselves; staff for any).
aidRoutes.post(
  '/:id/contributions',
  requireLinkedMember,
  validate({ params: aidCaseIdParam, body: contributeSchema }),
  asyncHandler(aidController.contribute),
);
