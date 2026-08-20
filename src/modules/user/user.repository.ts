import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

/** Data access for User. */
export const userRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  create(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data });
  },

  update(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({ where: { id }, data });
  },

  setRefreshTokenHash(id: string, refreshTokenHash: string | null) {
    return prisma.user.update({ where: { id }, data: { refreshTokenHash } });
  },

  /** Accounts awaiting leader verification (self-signups). */
  listInactive() {
    return prisma.user.findMany({
      where: { isActive: false },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, role: true, createdAt: true, memberId: true },
    });
  },
};
