import { Router } from 'express';
import { donationController } from './donation.controller';
import {
  createDonationSchema,
  donationIdParam,
  listDonationQuerySchema,
} from './donation.schema';
import { authenticate, requireLinkedMember } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';

export const donationRoutes = Router();

donationRoutes.use(authenticate);

donationRoutes.get(
  '/',
  validate({ query: listDonationQuerySchema }),
  asyncHandler(donationController.list),
);

donationRoutes.get(
  '/:id',
  validate({ params: donationIdParam }),
  asyncHandler(donationController.getById),
);

// Any authenticated user may record a donation (members give as themselves;
// staff may attribute it to any household/member). Treasurer confirms the
// amount afterwards via /payments/:id/confirm.
donationRoutes.post(
  '/',
  requireLinkedMember,
  validate({ body: createDonationSchema }),
  asyncHandler(donationController.create),
);
