import crypto from 'node:crypto';
import { userRepository } from '../user/user.repository';
import { hashPassword, verifyPassword } from '../../utils/password';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type AccessTokenPayload,
} from '../../utils/jwt';
import { prisma } from '../../lib/prisma';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../../utils/errors';
import { env } from '../../config/env';
import type {
  ChangePasswordInput,
  LoginInput,
  SignupInput,
  UpdateProfileInput,
  VerifyUserInput,
} from './auth.schema';
import { ROLE } from '../../config';
import type { Prisma } from '@prisma/client';
interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function publicUser(user: {
  id: string;
  email: string;
  role: AccessTokenPayload['role'];
  memberId: string | null;
}) {
  return { id: user.id, email: user.email, role: user.role, memberId: user.memberId };
}

const profileMemberSelect = {
  id: true,
  householdId: true,
  nameHmong: true,
  nameLatin: true,
  gender: true,
  dob: true,
  photoUrl: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  household: { select: { id: true, name: true } },
} satisfies Prisma.MemberSelect;

async function issueTokens(user: {
  id: string;
  role: AccessTokenPayload['role'];
  memberId: string | null;
}): Promise<AuthTokens> {
  const accessToken = signAccessToken({ sub: user.id, role: user.role, memberId: user.memberId });
  const refreshToken = signRefreshToken(user.id);
  // Store only the hash of the refresh token so a DB leak can't reuse it.
  await userRepository.setRefreshTokenHash(user.id, await hashPassword(refreshToken));
  return { accessToken, refreshToken };
}

export const authService = {
  /**
   * Self-registration. Creates a PENDING (inactive) member account. A
   * SUPER_ADMIN must verify it before the person can sign in. No tokens are
   * issued here.
   */
  async signup(input: SignupInput) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) throw conflict('Email is already registered');

    await userRepository.create({
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: ROLE.MEMBER,
      isActive: false,
    });

    return {
      message:
        'Account created. A super admin must verify your account before you can sign in.',
    };
  },

  async login(input: LoginInput) {
    const user = await userRepository.findByEmail(input.email);
    if (!user) throw unauthorized('Invalid email or credentials');

    const ok = await verifyPassword(input.password, user.passwordHash);
    if (!ok) throw unauthorized('Invalid password or credentials');

    // Only reveal the "pending" state once credentials are proven correct.
    if (!user.isActive) throw forbidden('Your account is awaiting verification by a super admin');

    const tokens = await issueTokens(user);
    return { user: publicUser(user), ...tokens };
  },

  async refresh(refreshToken: string) {
    let userId: string;
    try {
      userId = verifyRefreshToken(refreshToken).sub;
    } catch {
      throw unauthorized('Invalid or expired refresh token');
    }

    const user = await userRepository.findById(userId);
    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw unauthorized('Session is no longer valid');
    }

    const matches = await verifyPassword(refreshToken, user.refreshTokenHash);
    if (!matches) throw unauthorized('Session is no longer valid');

    const tokens = await issueTokens(user);
    return { user: publicUser(user), ...tokens };
  },

  async logout(userId: string) {
    await userRepository.setRefreshTokenHash(userId, null);
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { member: { select: profileMemberSelect } },
    });
    if (!user) throw unauthorized();
    return { user: publicUser(user), member: user.member };
  },

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const user = await userRepository.findById(userId);
    if (!user) throw unauthorized();

    if (input.email && input.email !== user.email) {
      const existing = await userRepository.findByEmail(input.email);
      if (existing && existing.id !== user.id) throw conflict('Email is already registered');
    }

    const memberData: Prisma.MemberUpdateInput = {};
    if (input.nameHmong !== undefined) memberData.nameHmong = input.nameHmong;
    if (input.nameLatin !== undefined) memberData.nameLatin = input.nameLatin;
    if (input.gender !== undefined) memberData.gender = input.gender;
    if (input.dob !== undefined) memberData.dob = input.dob;
    if (input.photoUrl !== undefined) memberData.photoUrl = input.photoUrl;

    const shouldUpdateMember = Object.keys(memberData).length > 0;
    if (shouldUpdateMember && !user.memberId) {
      throw badRequest('Your account is not linked to a member record');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: input.email ? { email: input.email } : {},
      });

      const member = user.memberId
        ? shouldUpdateMember
          ? await tx.member.update({
              where: { id: user.memberId },
              data: memberData,
              select: profileMemberSelect,
            })
          : await tx.member.findUnique({
              where: { id: user.memberId },
              select: profileMemberSelect,
            })
        : null;

      return { user: updatedUser, member };
    });

    return { user: publicUser(updated.user), member: updated.member };
  },

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await userRepository.findById(userId);
    if (!user) throw unauthorized();

    const ok = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!ok) throw badRequest('Current password is incorrect');

    await userRepository.update(user.id, {
      passwordHash: await hashPassword(input.newPassword),
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      refreshTokenHash: null,
    });

    return { message: 'Password updated. Please sign in again.' };
  },

  /**
   * Begin a password reset. Always returns the same generic response so the
   * endpoint can't be used to probe which emails exist. In non-production the
   * reset token is returned/logged for convenience (no email service wired up).
   */
  async forgotPassword(email: string) {
    const genericResponse = {
      message: 'If an account exists for that email, a reset link has been sent.',
    } as { message: string; resetToken?: string };

    const user = await userRepository.findByEmail(email);
    if (!user || !user.isActive) return genericResponse;

    // token = "<userId>.<secret>". Only the secret's hash is stored.
    const secret = crypto.randomBytes(32).toString('hex');
    await userRepository.update(user.id, {
      resetTokenHash: await hashPassword(secret),
      resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    });
    const token = `${user.id}.${secret}`;

    if (!env.isProduction) {
      console.log(`[auth] password reset token for ${email}: ${token}`);
      genericResponse.resetToken = token;
    }
    return genericResponse;
  },

  /** Complete a password reset using the token from forgotPassword. */
  async resetPassword(token: string, newPassword: string) {
    const sep = token.indexOf('.');
    if (sep === -1) throw badRequest('Invalid reset token');
    const userId = token.slice(0, sep);
    const secret = token.slice(sep + 1);

    const user = await userRepository.findById(userId);
    if (
      !user ||
      !user.resetTokenHash ||
      !user.resetTokenExpiresAt ||
      user.resetTokenExpiresAt.getTime() < Date.now()
    ) {
      throw badRequest('Invalid or expired reset token');
    }

    const matches = await verifyPassword(secret, user.resetTokenHash);
    if (!matches) throw badRequest('Invalid or expired reset token');

    await userRepository.update(user.id, {
      passwordHash: await hashPassword(newPassword),
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      // Invalidate any existing session.
      refreshTokenHash: null,
    });
    return { message: 'Password updated. You can now sign in.' };
  },

  /** Super admin: accounts awaiting verification. */
  listPending() {
    return userRepository.listInactive();
  },

  /** Super admin: activate a pending account, optionally linking a member and role. */
  async verifyUser(id: string, input: VerifyUserInput) {
    const user = await userRepository.findById(id);
    if (!user) throw notFound('User not found');
    if (user.isActive) throw badRequest('This account is already active');

    const data: Parameters<typeof userRepository.update>[1] = { isActive: true };
    if (input.role) data.role = input.role;
    if (input.memberId !== undefined) {
      data.member = input.memberId ? { connect: { id: input.memberId } } : { disconnect: true };
    }
    const updated = await userRepository.update(id, data);
    return publicUser(updated);
  },
};
