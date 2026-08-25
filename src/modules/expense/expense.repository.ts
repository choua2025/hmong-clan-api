import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const expenseInclude = {
  event: { select: { id: true, title: true, startAt: true } },
  aidCase: { select: { id: true, title: true, status: true } },
  asset: { select: { id: true, nameHmong: true, nameLatin: true } },
  requestedBy: { select: { id: true, email: true } },
  approvedBy: { select: { id: true, email: true } },
  disbursedBy: { select: { id: true, email: true } },
} satisfies Prisma.ExpenseInclude;

export const expenseRepository = {
  list(where: Prisma.ExpenseWhereInput, skip: number, take: number) {
    return prisma.$transaction([
      prisma.expense.findMany({
        where,
        skip,
        take,
        orderBy: { incurredAt: 'desc' },
        include: expenseInclude,
      }),
      prisma.expense.count({ where }),
    ]);
  },

  findById(id: string) {
    return prisma.expense.findUnique({ where: { id }, include: expenseInclude });
  },

  create(data: Prisma.ExpenseCreateInput) {
    return prisma.expense.create({ data, include: expenseInclude });
  },

  update(id: string, data: Prisma.ExpenseUpdateInput) {
    return prisma.expense.update({ where: { id }, data, include: expenseInclude });
  },

  delete(id: string) {
    return prisma.expense.delete({ where: { id } });
  },

  /** Total of every expense matching the filter, as a Decimal string. */
  async sum(where: Prisma.ExpenseWhereInput): Promise<string> {
    const result = await prisma.expense.aggregate({ _sum: { amount: true }, where });
    return (result._sum.amount ?? 0).toString();
  },

  /** Spend grouped by category, for the treasurer's breakdown. */
  byCategory(where: Prisma.ExpenseWhereInput) {
    return prisma.expense.groupBy({
      by: ['category'],
      where,
      _sum: { amount: true },
      _count: { _all: true },
      orderBy: { category: 'asc' },
    });
  },

  /** Row counts per status, so the UI can badge the approval queue. */
  byStatus(where: Prisma.ExpenseWhereInput) {
    return prisma.expense.groupBy({
      by: ['status'],
      where,
      _sum: { amount: true },
      _count: { _all: true },
      orderBy: { status: 'asc' },
    });
  },
};
