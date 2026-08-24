import { Router } from 'express';
import { memberController } from './member.controller';
import {
  createMemberSchema,
  listMemberQuerySchema,
  memberIdParam,
  updateMemberSchema,
} from './member.schema';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { PERMISSIONS } from '../../config';
export const memberRoutes = Router();

memberRoutes.use(authenticate);

memberRoutes.get(
  '/',
  validate({ query: listMemberQuerySchema }),
  asyncHandler(memberController.list),
);

memberRoutes.get(
  '/:id',
  validate({ params: memberIdParam }),
  asyncHandler(memberController.getById),
);

// Leaders register and manage members (claude.md §5).
memberRoutes.post(
  '/',
  authorize(...PERMISSIONS.MEMBER_MANAGEMENT),
  validate({ body: createMemberSchema }),
  asyncHandler(memberController.create),
);

memberRoutes.patch(
  '/:id',
  authorize(...PERMISSIONS.MEMBER_MANAGEMENT),
  validate({ params: memberIdParam, body: updateMemberSchema }),
  asyncHandler(memberController.update),
);

memberRoutes.delete(
  '/:id',
  authorize(...PERMISSIONS.MEMBER_MANAGEMENT),
  validate({ params: memberIdParam }),
  asyncHandler(memberController.remove),
);
