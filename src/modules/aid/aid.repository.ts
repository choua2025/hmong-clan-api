import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const caseDetailInclude = {
  affectedHousehold: { select: { id: true, name: true } },
  openedBy: { select: { id: true, email: true } },
  contributions: {
    orderBy: { createdAt: 'desc' },
    include: {
      household: { select: { id: true, name: true } },
      member: { select: { id: true, nameHmong: true, nameLatin: true } },
      payment: { select: { id: true, amount: true, currency: true, status: true } },
    },
  },
} satisfies Prisma.MutualAidCaseInclude;

export const aidRepository = {
  list(where: Prisma.MutualAidCaseWhereInput, skip: number, take: number) {
    return prisma.$transaction([
      prisma.mutualAidCase.findMany({
        where,
        skip,
        take,
        orderBy: { openedAt: 'desc' },
        include: {
          affectedHousehold: { select: { id: true, name: true } },
          _count: { select: { contributions: true } },
        },
      }),
      prisma.mutualAidCase.count({ where }),
    ]);
  },

  findById(id: string) {
    return prisma.mutualAidCase.findUnique({ where: { id }, include: caseDetailInclude });
  },

  create(data: Prisma.MutualAidCaseCreateInput) {
    return prisma.mutualAidCase.create({
      data,
      include: { affectedHousehold: { select: { id: true, name: true } } },
    });
  },

  update(id: string, data: Prisma.MutualAidCaseUpdateInput) {
    return prisma.mutualAidCase.update({ where: { id }, data, include: caseDetailInclude });
  },

  createContribution(data: Prisma.AidContributionCreateInput) {
    return prisma.aidContribution.create({
      data,
      include: {
        household: { select: { id: true, name: true } },
        member: { select: { id: true, nameHmong: true, nameLatin: true } },
        payment: { select: { id: true, amount: true, currency: true, status: true } },
      },
    });
  },

  /** Sum of CONFIRMED contribution amounts for a case (the auditable total). */
  async sumConfirmed(caseId: string): Promise<string> {
    const result = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { aidContribution: { caseId }, status: 'CONFIRMED' },
    });
    return (result._sum.amount ?? 0).toString();
  },
};
