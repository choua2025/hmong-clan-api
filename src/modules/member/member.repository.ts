import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export const memberRepository = {
  list(where: Prisma.MemberWhereInput, skip: number, take: number) {
    return prisma.$transaction([
      prisma.member.findMany({
        where,
        skip,
        take,
        orderBy: [{ nameLatin: 'asc' }],
        include: {
          household: { select: { id: true, name: true } },
          user: { select: { id: true, email: true, role: true } },
        },
      }),
      prisma.member.count({ where }),
    ]);
  },

  findById(id: string) {
    return prisma.member.findUnique({
      where: { id },
      include: {
        household: { select: { id: true, name: true } },
        user: { select: { id: true, email: true, role: true } },
      },
    });
  },

  create(data: Prisma.MemberCreateInput) {
    return prisma.member.create({ data });
  },

  update(id: string, data: Prisma.MemberUpdateInput) {
    return prisma.member.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.member.delete({ where: { id } });
  },

  householdExists(id: string) {
    return prisma.household.findUnique({ where: { id }, select: { id: true } });
  },
};
