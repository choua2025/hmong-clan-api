import type { ExpenseStatus, OfficePosition, Prisma } from '@prisma/client';
import type { AuthUser } from '../../types/express';
import { prisma } from '../../lib/prisma';
import { expenseRepository } from './expense.repository';
import { badRequest, forbidden, notFound } from '../../utils/errors';
import { isStaff } from '../../utils/scope';
import { toSkipTake } from '../../utils/validators';
import { env } from '../../config/env';
import type {
  ApproveExpenseInput,
  CreateExpenseInput,
  DisburseExpenseInput,
  ListExpenseQuery,
  RejectExpenseInput,
  SummaryQuery,
  UpdateExpenseInput,
  VoidExpenseInput,
} from './expense.schema';

/**
 * Expense lifecycle. Money leaves the association only along this path:
 *
 *   DRAFT ──submit──▶ SUBMITTED ──approve──▶ APPROVED ──disburse──▶ PAID
 *     ▲                   │
 *     └──── reject ───────┘  (REJECTED, editable and re-submittable)
 *
 * Anything not yet PAID can be voided. A PAID expense is immutable — reversing
 * real spending is a bookkeeping entry, not an edit.
 */
const EDITABLE: readonly ExpenseStatus[] = ['DRAFT', 'REJECTED'];

/** Only the person who raised it, or staff, may touch a draft. */
function assertCanEdit(user: AuthUser, expense: { requestedById: string | null }) {
  if (isStaff(user)) return;
  if (expense.requestedById !== user.id) throw forbidden();
}

/** Offices whose sitting holder may sign off association spending. */
const APPROVING_OFFICES: OfficePosition[] = ['PRESIDENT', 'VICE_PRESIDENT'];

/**
 * Approval authority is an office, not a permission — that is the whole point
 * of keeping OfficeTerm separate from User.role. SUPER_ADMIN overrides so the
 * association is not deadlocked before its first appointment.
 */
async function assertApprovalAuthority(user: AuthUser) {
  if (user.role === 'SUPER_ADMIN') return;
  if (!user.memberId) {
    throw forbidden('Approving an expense requires a login linked to a member record');
  }
  const term = await prisma.officeTerm.findFirst({
    // A term is sitting while it holds a seat key; retired terms store null.
    where: {
      memberId: user.memberId,
      currentSeat: { not: null },
      position: { in: APPROVING_OFFICES },
    },
    select: { id: true },
  });
  if (!term) {
    throw forbidden('Only the sitting president or vice-president may approve an expense');
  }
}

export const expenseService = {
  async list(query: ListExpenseQuery) {
    const where: Prisma.ExpenseWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    if (query.eventId) where.eventId = query.eventId;
    if (query.aidCaseId) where.aidCaseId = query.aidCaseId;
    if (query.assetId) where.assetId = query.assetId;
    if (query.from || query.to) {
      where.incurredAt = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      };
    }
    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { titleLao: { contains: query.q, mode: 'insensitive' } },
        { payeeName: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const { skip, take } = toSkipTake(query);
    const [items, total] = await expenseRepository.list(where, skip, take);
    // The running total for the current filter, not just this page.
    const filteredTotal = await expenseRepository.sum(where);
    return { items, total, filteredTotal, page: query.page, pageSize: query.pageSize };
  },

  async getById(id: string) {
    const expense = await expenseRepository.findById(id);
    if (!expense) throw notFound('Expense not found');
    return expense;
  },

  /**
   * Treasurer's overview: what has actually left the account, what is still
   * waiting on an approval, and where the money went.
   */
  async summary(query: SummaryQuery) {
    const base: Prisma.ExpenseWhereInput = {};
    if (query.eventId) base.eventId = query.eventId;
    if (query.from || query.to) {
      base.incurredAt = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      };
    }

    const [paid, approvedNotPaid, submitted, byCategory, byStatus] = await Promise.all([
      expenseRepository.sum({ ...base, status: 'PAID' }),
      expenseRepository.sum({ ...base, status: 'APPROVED' }),
      expenseRepository.sum({ ...base, status: 'SUBMITTED' }),
      // Only real spending belongs in the breakdown — rejected and voided
      // rows would inflate every category.
      expenseRepository.byCategory({ ...base, status: { in: ['APPROVED', 'PAID'] } }),
      expenseRepository.byStatus(base),
    ]);

    return {
      currency: env.defaultCurrency,
      totalPaid: paid,
      totalApprovedUnpaid: approvedNotPaid,
      totalAwaitingApproval: submitted,
      byCategory: byCategory.map((row) => ({
        category: row.category,
        total: (row._sum.amount ?? 0).toString(),
        count: row._count._all,
      })),
      byStatus: byStatus.map((row) => ({
        status: row.status,
        total: (row._sum.amount ?? 0).toString(),
        count: row._count._all,
      })),
    };
  },

  async create(user: AuthUser, input: CreateExpenseInput) {
    const data: Prisma.ExpenseCreateInput = {
      title: input.title,
      titleLao: input.titleLao,
      description: input.description,
      category: input.category,
      amount: input.amount,
      currency: input.currency ?? env.defaultCurrency,
      incurredAt: input.incurredAt,
      payeeName: input.payeeName,
      payeePhone: input.payeePhone,
      receiptUrl: input.receiptUrl,
      status: input.submit ? 'SUBMITTED' : 'DRAFT',
      requestedBy: { connect: { id: user.id } },
    };
    if (input.eventId) data.event = { connect: { id: input.eventId } };
    if (input.aidCaseId) data.aidCase = { connect: { id: input.aidCaseId } };
    if (input.assetId) data.asset = { connect: { id: input.assetId } };

    return expenseRepository.create(data);
  },

  async update(user: AuthUser, id: string, input: UpdateExpenseInput) {
    const expense = await expenseRepository.findById(id);
    if (!expense) throw notFound('Expense not found');
    if (!EDITABLE.includes(expense.status)) {
      throw badRequest(`An expense that is ${expense.status.toLowerCase()} can no longer be edited`);
    }
    assertCanEdit(user, expense);

    const data: Prisma.ExpenseUpdateInput = {
      title: input.title,
      titleLao: input.titleLao,
      description: input.description,
      category: input.category,
      amount: input.amount,
      currency: input.currency,
      incurredAt: input.incurredAt,
      payeeName: input.payeeName,
      payeePhone: input.payeePhone,
      receiptUrl: input.receiptUrl,
    };
    // A null clears the link; undefined leaves it untouched.
    if (input.eventId !== undefined) {
      data.event = input.eventId ? { connect: { id: input.eventId } } : { disconnect: true };
    }
    if (input.aidCaseId !== undefined) {
      data.aidCase = input.aidCaseId ? { connect: { id: input.aidCaseId } } : { disconnect: true };
    }
    if (input.assetId !== undefined) {
      data.asset = input.assetId ? { connect: { id: input.assetId } } : { disconnect: true };
    }

    return expenseRepository.update(id, data);
  },

  /** Send a draft (or a corrected rejection) to the approval queue. */
  async submit(user: AuthUser, id: string) {
    const expense = await expenseRepository.findById(id);
    if (!expense) throw notFound('Expense not found');
    if (!EDITABLE.includes(expense.status)) {
      throw badRequest('Only a draft or rejected expense can be submitted');
    }
    assertCanEdit(user, expense);

    return expenseRepository.update(id, {
      status: 'SUBMITTED',
      rejectReason: null,
      // A resubmission is a fresh request: clear the previous decision.
      approvedBy: { disconnect: true },
      approvedAt: null,
    });
  },

  /**
   * Approve the spend. The approver may correct the amount — their figure is
   * the authoritative one, never a scanned receipt's.
   *
   * Authority comes from a sitting OfficeTerm, not from `User.role`: holding
   * the LEADER permission lets you reach this endpoint, but signing off
   * requires actually being the president (or vice-president). SUPER_ADMIN
   * overrides, which is also the escape hatch before any officer is appointed.
   */
  async approve(user: AuthUser, id: string, input: ApproveExpenseInput) {
    const expense = await expenseRepository.findById(id);
    if (!expense) throw notFound('Expense not found');
    if (expense.status !== 'SUBMITTED') {
      throw badRequest('Only a submitted expense can be approved');
    }
    // The person who raised it must not also sign it off.
    if (expense.requestedById === user.id && user.role !== 'SUPER_ADMIN') {
      throw forbidden('An expense must be approved by someone other than the requester');
    }
    await assertApprovalAuthority(user);

    return expenseRepository.update(id, {
      status: 'APPROVED',
      amount: input.amount ?? expense.amount,
      approvedBy: { connect: { id: user.id } },
      approvedAt: input.approvedAt ?? new Date(),
      rejectReason: null,
    });
  },

  async reject(user: AuthUser, id: string, input: RejectExpenseInput) {
    const expense = await expenseRepository.findById(id);
    if (!expense) throw notFound('Expense not found');
    if (expense.status !== 'SUBMITTED') {
      throw badRequest('Only a submitted expense can be rejected');
    }

    return expenseRepository.update(id, {
      status: 'REJECTED',
      rejectReason: input.reason,
      approvedBy: { connect: { id: user.id } },
      approvedAt: new Date(),
    });
  },

  /**
   * Treasurer pays out an approved expense. A receipt is mandatory: it is the
   * outflow counterpart of a transfer slip, and money must never leave the
   * association without documentary proof.
   */
  async disburse(user: AuthUser, id: string, input: DisburseExpenseInput) {
    const expense = await expenseRepository.findById(id);
    if (!expense) throw notFound('Expense not found');
    if (expense.status !== 'APPROVED') {
      throw badRequest('Only an approved expense can be disbursed');
    }

    const receiptUrl = input.receiptUrl ?? expense.receiptUrl;
    if (!receiptUrl) {
      throw badRequest('A receipt is required before an expense can be marked paid');
    }

    return expenseRepository.update(id, {
      status: 'PAID',
      disbursedBy: { connect: { id: user.id } },
      disbursedAt: input.disbursedAt ?? new Date(),
      receiptUrl,
    });
  },

  /** Cancel an expense that will never be paid. */
  async void(id: string, input: VoidExpenseInput) {
    const expense = await expenseRepository.findById(id);
    if (!expense) throw notFound('Expense not found');
    if (expense.status === 'PAID') {
      throw badRequest('A paid expense cannot be voided — record a reversing entry instead');
    }
    if (expense.status === 'VOID') throw badRequest('This expense is already void');

    return expenseRepository.update(id, { status: 'VOID', rejectReason: input.reason });
  },

  /** Only an unsubmitted draft can be deleted outright. */
  async remove(user: AuthUser, id: string) {
    const expense = await expenseRepository.findById(id);
    if (!expense) throw notFound('Expense not found');
    if (expense.status !== 'DRAFT') {
      throw badRequest('Only a draft expense can be deleted — void it instead');
    }
    assertCanEdit(user, expense);

    await expenseRepository.delete(id);
    return { message: 'Expense deleted' };
  },
};
