import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

/** Loan statuses that hold units away from the store room. */
export const ACTIVE_LOAN_STATUSES = ['APPROVED', 'OUT', 'OVERDUE'] as const;

const loanInclude = {
  asset: { select: { id: true, nameHmong: true, nameLatin: true, unit: true, category: true } },
  household: { select: { id: true, name: true } },
  member: { select: { id: true, nameHmong: true, nameLatin: true } },
  event: { select: { id: true, title: true, startAt: true } },
  approvedBy: { select: { id: true, email: true } },
} satisfies Prisma.AssetLoanInclude;

const assetDetailInclude = {
  loans: {
    orderBy: { requestedAt: 'desc' },
    take: 50,
    include: {
      household: { select: { id: true, name: true } },
      member: { select: { id: true, nameHmong: true, nameLatin: true } },
      event: { select: { id: true, title: true, startAt: true } },
      approvedBy: { select: { id: true, email: true } },
    },
  },
  _count: { select: { loans: true, expenses: true } },
} satisfies Prisma.AssetInclude;

export const assetRepository = {
  list(where: Prisma.AssetWhereInput, skip: number, take: number) {
    return prisma.$transaction([
      prisma.asset.findMany({
        where,
        skip,
        take,
        orderBy: [{ category: 'asc' }, { nameLatin: 'asc' }],
        include: { _count: { select: { loans: true } } },
      }),
      prisma.asset.count({ where }),
    ]);
  },

  findById(id: string) {
    return prisma.asset.findUnique({ where: { id }, include: assetDetailInclude });
  },

  exists(id: string) {
    return prisma.asset.findUnique({
      where: { id },
      select: { id: true, quantity: true, status: true, unit: true, currency: true },
    });
  },

  create(data: Prisma.AssetCreateInput) {
    return prisma.asset.create({ data, include: { _count: { select: { loans: true } } } });
  },

  update(id: string, data: Prisma.AssetUpdateInput) {
    return prisma.asset.update({ where: { id }, data, include: assetDetailInclude });
  },

  delete(id: string) {
    return prisma.asset.delete({ where: { id } });
  },

  /**
   * Units currently committed to open loans (approved, out, or overdue),
   * counting only what has not been handed back yet.
   */
  async committedQuantity(assetId: string, excludeLoanId?: string): Promise<number> {
    const loans = await prisma.assetLoan.findMany({
      where: {
        assetId,
        status: { in: [...ACTIVE_LOAN_STATUSES] },
        ...(excludeLoanId ? { id: { not: excludeLoanId } } : {}),
      },
      select: { quantity: true, quantityReturned: true },
    });
    return loans.reduce((sum, l) => sum + (l.quantity - l.quantityReturned), 0);
  },

  /** Committed units for many assets at once, keyed by assetId. */
  async committedQuantities(assetIds: string[]): Promise<Map<string, number>> {
    if (assetIds.length === 0) return new Map();
    const loans = await prisma.assetLoan.findMany({
      where: { assetId: { in: assetIds }, status: { in: [...ACTIVE_LOAN_STATUSES] } },
      select: { assetId: true, quantity: true, quantityReturned: true },
    });
    const map = new Map<string, number>();
    for (const l of loans) {
      map.set(l.assetId, (map.get(l.assetId) ?? 0) + (l.quantity - l.quantityReturned));
    }
    return map;
  },

  listLoans(where: Prisma.AssetLoanWhereInput, skip: number, take: number) {
    return prisma.$transaction([
      prisma.assetLoan.findMany({
        where,
        skip,
        take,
        orderBy: { requestedAt: 'desc' },
        include: loanInclude,
      }),
      prisma.assetLoan.count({ where }),
    ]);
  },

  findLoanById(id: string) {
    return prisma.assetLoan.findUnique({ where: { id }, include: loanInclude });
  },

  createLoan(data: Prisma.AssetLoanCreateInput) {
    return prisma.assetLoan.create({ data, include: loanInclude });
  },

  updateLoan(id: string, data: Prisma.AssetLoanUpdateInput) {
    return prisma.assetLoan.update({ where: { id }, data, include: loanInclude });
  },

  deleteLoan(id: string) {
    return prisma.assetLoan.delete({ where: { id } });
  },

  /**
   * Flip out-loans whose due date has passed to OVERDUE. Called before listing
   * loans so the status a user sees is never stale.
   */
  markOverdue(now: Date) {
    return prisma.assetLoan.updateMany({
      where: { status: 'OUT', dueAt: { lt: now } },
      data: { status: 'OVERDUE' },
    });
  },
};
