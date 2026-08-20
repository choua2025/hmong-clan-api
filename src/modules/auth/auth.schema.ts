import { z } from 'zod';
import { dateSchema } from '../../utils/validators';

export const signupSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const verifyUserSchema = z.object({
  // Optionally link the verified account to an existing member record.
  memberId: z.string().uuid().nullable().optional(),
  // Optionally elevate the role during verification.
  role: z.enum(['SUPER_ADMIN', 'LEADER', 'TREASURER', 'MEMBER']).optional(),
});

export const updateProfileSchema = z.object({
  email: z.string().email().toLowerCase().optional(),
  nameHmong: z.string().trim().min(1).max(200).optional(),
  nameLatin: z.string().trim().min(1).max(200).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).nullable().optional(),
  dob: dateSchema.nullable().optional(),
  photoUrl: z.string().url().max(1000).nullable().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const userIdParam = z.object({ id: z.string().uuid() });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyUserInput = z.infer<typeof verifyUserSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
