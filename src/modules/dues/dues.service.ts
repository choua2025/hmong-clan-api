import { Prisma } from '@prisma/client';
import type { AuthUser } from '../../types/express';
import { prisma } from '../../lib/prisma';
import { duesRepository } from './dues.repository';
import { paymentService } from '../payment/payment.service';
import { badRequest, conflict, notFound } from '../../utils/errors';
import { assertHouseholdAccess, resolveScopedHouseholdId } from '../../utils/scope';
import { toSkipTake } from '../../utils/validators';
import { env } from '../../config/env';
import type {
  ConfirmDuesInput,
  CreateDuesInput,
  ListDuesQuery,
  PayDuesInput,
  RejectDuesInput,
} from './dues.schema';

export const duesService = {
  async list(user: AuthUser, query: ListDuesQuery) {
    const where: Prisma.DuesWhereInput = {};

    const scopedHouseholdId = await resolveScopedHouseholdId(user);
    if (scopedHouseholdId) {
      where.householdId = scopedHouseholdId;
    } else if (query.householdId) {
      where.householdId = query.householdId;
    }
    if (query.status) where.status = query.status;
    if (query.period) where.period = query.period;

    const { skip, take } = toSkipTake(query);
    const [items, total] = await duesRepository.list(where, skip, take);
    return { items, total, page: query.page, pageSize: query.pageSize };
  },

  async getById(user: AuthUser, id: string) {
    const dues = await duesRepository.findById(id);
    if (!dues) throw notFound('Dues record not found');
    await assertHouseholdAccess(user, dues.householdId);
    return dues;
  },

  /** Charge a household for a period (treasurer/leader). */
  async create(input: CreateDuesInput) {
    const household = await duesRepository.householdExists(input.householdId);
    if (!household) throw badRequest('Household does not exist');

    try {
      return await duesRepository.create({
        household: { connect: { id: input.householdId } },
        period: input.period,
        amount: input.amount,
        currency: input.currency ?? env.defaultCurrency,
        dueDate: input.dueDate,
        status: 'UNPAID',
      });
    } catch (err) {
      // Unique (householdId, period) — already charged for this period.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw conflict(`This household already has dues for period "${input.period}"`);
      }
      throw err;
    }
  },

  /**
   * A household submits proof of transfer. Creates a PENDING Payment and moves
   * the dues to PENDING. The submitted/OCR amount is NOT trusted — a treasurer
   * confirms the real amount before money is recorded (claude.md §5).
   */
  async submitPayment(user: AuthUser, duesId: string, input: PayDuesInput) {
    const dues = await duesRepository.findById(duesId);
    if (!dues) throw notFound('Dues record not found');
    await assertHouseholdAccess(user, dues.householdId);

    if (dues.status === 'PAID') throw badRequest('These dues are already paid');
    if (dues.status === 'WAIVED') throw badRequest('These dues have been waived');
    if (dues.payment && dues.payment.status === 'PENDING') {
      throw conflict('A payment for these dues is already awaiting confirmation');
    }

    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          // Provisional amount only; authoritative value is set on confirmation.
          amount: input.ocrAmount ?? dues.amount,
          currency: dues.currency,
          slipUrl: input.slipUrl,
          reference: input.reference,
          ocrAmount: input.ocrAmount,
          ocrRaw: input.ocrRaw,
          status: 'PENDING',
        },
      });
      return tx.dues.update({
        where: { id: duesId },
        data: { status: 'PENDING', payment: { connect: { id: payment.id } } },
        include: { payment: true, household: { select: { id: true, name: true } } },
      });
    });
  },

  /**
   * Treasurer confirms the human-verified amount; dues become PAID. Delegates
   * the payment transition to paymentService (the single source of truth),
   * which also flips the linked Dues status to PAID in one transaction.
   */
  async confirmPayment(user: AuthUser, duesId: string, input: ConfirmDuesInput) {
    const dues = await duesRepository.findById(duesId);
    if (!dues) throw notFound('Dues record not found');
    if (!dues.payment) throw badRequest('There is no submitted payment to confirm');

    await paymentService.confirm(user, dues.payment.id, input.amount);
    return duesRepository.findById(duesId);
  },

  /** Treasurer rejects a payment; dues return to UNPAID for re-submission. */
  async rejectPayment(user: AuthUser, duesId: string, input: RejectDuesInput) {
    const dues = await duesRepository.findById(duesId);
    if (!dues) throw notFound('Dues record not found');
    if (!dues.payment) throw badRequest('There is no submitted payment to reject');

    await paymentService.reject(user, dues.payment.id, input.reason);
    return duesRepository.findById(duesId);
  },
};
