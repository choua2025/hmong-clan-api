import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma';

/** A Prisma client or an interactive-transaction client. */
type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Data access for the shared Payment record. Dues, Donation, and
 * AidContribution all settle through Payment, so this repository is reused
 * across those flows.
 */
const paymentInclude = {
  dues: { include: { household: { select: { id: true, name: true } } } },
  donation: true,
  aidContribution: { include: { case: { select: { id: true, title: true } } } },
  confirmedBy: { select: { id: true, email: true } },
} satisfies Prisma.PaymentInclude;

export const paymentRepository = {
  create(data: Prisma.PaymentCreateInput, db: Db = prisma) {
    return db.payment.create({ data });
  },

  list(where: Prisma.PaymentWhereInput, skip: number, take: number) {
    return prisma.$transaction([
      prisma.payment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: paymentInclude,
      }),
      prisma.payment.count({ where }),
    ]);
  },

  findById(id: string) {
    return prisma.payment.findUnique({ where: { id }, include: paymentInclude });
  },

  update(id: string, data: Prisma.PaymentUpdateInput, db: Db = prisma) {
    return db.payment.update({ where: { id }, data });
  },
};
