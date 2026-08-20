import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../../types/express';
import { prisma } from '../../lib/prisma';
import { paymentRepository } from './payment.repository';
import { badRequest, notFound } from '../../utils/errors';
import { toSkipTake } from '../../utils/validators';
import type { ListPaymentQuery } from './payment.schema';

/**
 * Single source of truth for Payment state transitions. Dues, Donation, and
 * AidContribution all settle through Payment, so confirming/rejecting lives
 * here — and side effects on a linked Dues record happen in the same
 * transaction.
 */
export const paymentService = {
  async list(query: ListPaymentQuery) {
    const where: Prisma.PaymentWhereInput = {};
    if (query.status) where.status = query.status;
    const { skip, take } = toSkipTake(query);
    const [items, total] = await paymentRepository.list(where, skip, take);
    return { items, total, page: query.page, pageSize: query.pageSize };
  },

  async getById(id: string) {
    const payment = await paymentRepository.findById(id);
    if (!payment) throw notFound('Payment not found');
    return payment;
  },

  /**
   * Confirm a pending payment. `amount` is the human-verified, authoritative
   * value (the OCR/QR amount is never trusted). If the payment settles a Dues
   * record, that record is marked PAID atomically.
   */
  async confirm(user: AuthUser, paymentId: string, amount: Prisma.Decimal) {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) throw notFound('Payment not found');
    if (payment.status !== 'PENDING') throw badRequest('This payment has already been actioned');

    return prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          amount,
          status: 'CONFIRMED',
          confirmedBy: { connect: { id: user.id } },
          confirmedAt: new Date(),
          rejectReason: null,
        },
        include: { dues: true, donation: true, aidContribution: true },
      });
      if (updated.dues) {
        await tx.dues.update({ where: { id: updated.dues.id }, data: { status: 'PAID' } });
      }
      return updated;
    });
  },

  /** Reject a pending payment. A linked Dues record returns to UNPAID. */
  async reject(user: AuthUser, paymentId: string, reason: string) {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) throw notFound('Payment not found');
    if (payment.status !== 'PENDING') throw badRequest('This payment has already been actioned');

    return prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'REJECTED',
          rejectReason: reason,
          confirmedBy: { connect: { id: user.id } },
          confirmedAt: new Date(),
        },
        include: { dues: true, donation: true, aidContribution: true },
      });
      if (updated.dues) {
        await tx.dues.update({ where: { id: updated.dues.id }, data: { status: 'UNPAID' } });
      }
      return updated;
    });
  },
};
