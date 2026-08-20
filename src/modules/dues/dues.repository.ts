import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const duesInclude = {
  household: { select: { id: true, name: true } },
  payment: true,
} satisfies Prisma.DuesInclude;

export const duesRepository = {
  list(where: Prisma.DuesWhereInput, skip: number, take: number) {
    return prisma.$transaction([
      prisma.dues.findMany({
        where,
        skip,
        take,
        orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
        include: duesInclude,
      }),
      prisma.dues.count({ where }),
    ]);
  },

  findById(id: string) {
    return prisma.dues.findUnique({ where: { id }, include: duesInclude });
  },

  create(data: Prisma.DuesCreateInput) {
    return prisma.dues.create({ data, include: duesInclude });
  },

  householdExists(id: string) {
    return prisma.household.findUnique({ where: { id }, select: { id: true } });
  },
};
