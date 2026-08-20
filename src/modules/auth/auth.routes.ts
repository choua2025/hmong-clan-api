import { Router } from 'express';
import { authController } from './auth.controller';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  resetPasswordSchema,
  signupSchema,
  updateProfileSchema,
  userIdParam,
  verifyUserSchema,
} from './auth.schema';
import { validate } from '../../middleware/validate';
import { authenticate, authorize } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { PERMISSIONS } from '../../config';
export const authRoutes = Router();

// ── Public ───────────────────────────────────────────────
authRoutes.post('/signup', validate({ body: signupSchema }), asyncHandler(authController.signup));
authRoutes.post('/login', validate({ body: loginSchema }), asyncHandler(authController.login));
authRoutes.post('/refresh', validate({ body: refreshSchema }), asyncHandler(authController.refresh));
authRoutes.post(
  '/forgot-password',
  validate({ body: forgotPasswordSchema }),
  asyncHandler(authController.forgotPassword),
);
authRoutes.post(
  '/reset-password',
  validate({ body: resetPasswordSchema }),
  asyncHandler(authController.resetPassword),
);

// ── Authenticated ────────────────────────────────────────
authRoutes.post('/logout', authenticate, asyncHandler(authController.logout));
authRoutes.get('/me', authenticate, asyncHandler(authController.me));
authRoutes.patch(
  '/profile',
  authenticate,
  validate({ body: updateProfileSchema }),
  asyncHandler(authController.updateProfile),
);
authRoutes.patch(
  '/password',
  authenticate,
  validate({ body: changePasswordSchema }),
  asyncHandler(authController.changePassword),
);

// ── Leader/admin: verify pending self-registrations ──────
authRoutes.get(
  '/pending-users',
  authenticate,
  authorize(...PERMISSIONS.USER_MANAGEMENT),
  asyncHandler(authController.listPending),
);
authRoutes.post(
  '/pending-users/:id/verify',
  authenticate,
  authorize(...PERMISSIONS.USER_MANAGEMENT),
  validate({ params: userIdParam, body: verifyUserSchema }),
  asyncHandler(authController.verifyUser),
);
