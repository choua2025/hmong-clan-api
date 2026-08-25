import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../../types/express';
import { prisma } from '../../lib/prisma';
import { assetRepository } from './asset.repository';
import { badRequest, forbidden, notFound } from '../../utils/errors';
import { isStaff, resolveScopedHouseholdId } from '../../utils/scope';
import { toSkipTake } from '../../utils/validators';
import { env } from '../../config/env';
import type {
  ApproveLoanInput,
  CheckoutLoanInput,
  CreateAssetInput,
  CreateLoanInput,
  ListAssetQuery,
  ListLoanQuery,
  MarkLostLoanInput,
  ReturnLoanInput,
  UpdateAssetInput,
} from './asset.schema';

/** Units still in the borrower's hands for a loan. */
function outstanding(loan: { quantity: number; quantityReturned: number }): number {
  return loan.quantity - loan.quantityReturned;
}

/**
 * Resolve who is borrowing. Staff may lend to any household/member; an
 * ordinary member always borrows as themselves regardless of what was sent.
 */
async function resolveBorrower(
  user: AuthUser,
  input: { householdId?: string; memberId?: string },
): Promise<{ householdId?: string; memberId?: string }> {
  if (isStaff(user)) {
    if (!input.householdId && !input.memberId) {
      throw badRequest('A borrowing household or member is required');
    }
    return { householdId: input.householdId, memberId: input.memberId };
  }
  const householdId = await resolveScopedHouseholdId(user); // throws if unlinked
  return { householdId: householdId ?? undefined, memberId: user.memberId ?? undefined };
}

/** Members may only see their own household's loans; staff see everything. */
async function scopeLoanFilter(user: AuthUser, where: Prisma.AssetLoanWhereInput) {
  const scopedHouseholdId = await resolveScopedHouseholdId(user);
  if (scopedHouseholdId === null) return where;
  return {
    ...where,
    OR: [{ householdId: scopedHouseholdId }, { member: { householdId: scopedHouseholdId } }],
  } satisfies Prisma.AssetLoanWhereInput;
}

export const assetService = {
  // ── Register ───────────────────────────────────────────────

  async list(query: ListAssetQuery) {
    const where: Prisma.AssetWhereInput = {};
    if (query.category) where.category = query.category;
    if (query.status) where.status = query.status;
    if (query.condition) where.condition = query.condition;
    if (query.q) {
      where.OR = [
        { nameHmong: { contains: query.q, mode: 'insensitive' } },
        { nameLatin: { contains: query.q, mode: 'insensitive' } },
        { location: { contains: query.q, mode: 'insensitive' } },
        { serialNo: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    // "Available to borrow" always implies the asset itself is in service.
    if (query.availableOnly) where.status = 'AVAILABLE';

    const { skip, take } = toSkipTake(query);
    const [rows, total] = await assetRepository.list(where, skip, take);

    const committed = await assetRepository.committedQuantities(rows.map((a) => a.id));
    const items = rows.map((asset) => {
      const onLoan = committed.get(asset.id) ?? 0;
      return { ...asset, onLoan, availableQuantity: Math.max(asset.quantity - onLoan, 0) };
    });

    return {
      items: query.availableOnly ? items.filter((a) => a.availableQuantity > 0) : items,
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  },

  async getById(id: string) {
    const asset = await assetRepository.findById(id);
    if (!asset) throw notFound('Asset not found');
    const onLoan = await assetRepository.committedQuantity(id);
    return { ...asset, onLoan, availableQuantity: Math.max(asset.quantity - onLoan, 0) };
  },

  create(input: CreateAssetInput) {
    const data: Prisma.AssetCreateInput = {
      nameHmong: input.nameHmong,
      nameLatin: input.nameLatin,
      category: input.category,
      description: input.description,
      quantity: input.quantity,
      unit: input.unit,
      condition: input.condition,
      status: input.status,
      acquiredAt: input.acquiredAt,
      acquisitionCost: input.acquisitionCost,
      currency: input.currency ?? env.defaultCurrency,
      location: input.location,
      photoUrl: input.photoUrl,
      serialNo: input.serialNo,
      notes: input.notes,
    };
    return assetRepository.create(data);
  },

  async update(id: string, input: UpdateAssetInput) {
    const asset = await assetRepository.exists(id);
    if (!asset) throw notFound('Asset not found');

    // Shrinking the register below what is already lent out would make
    // availability negative and silently break future checks.
    if (input.quantity !== undefined) {
      const onLoan = await assetRepository.committedQuantity(id);
      if (input.quantity < onLoan) {
        throw badRequest(`${onLoan} unit(s) are currently on loan — quantity cannot be lower`);
      }
    }
    if (input.status === 'DISPOSED') {
      const onLoan = await assetRepository.committedQuantity(id);
      if (onLoan > 0) throw badRequest('Return all outstanding loans before disposing of an asset');
    }

    return assetRepository.update(id, input);
  },

  async remove(id: string) {
    const asset = await assetRepository.exists(id);
    if (!asset) throw notFound('Asset not found');
    const onLoan = await assetRepository.committedQuantity(id);
    if (onLoan > 0) throw badRequest('Return all outstanding loans before deleting an asset');
    // Loans cascade with the asset; historical expenses keep a null assetId.
    await assetRepository.delete(id);
    return { message: 'Asset deleted' };
  },

  // ── Loans ──────────────────────────────────────────────────

  async listLoans(user: AuthUser, query: ListLoanQuery) {
    // Refresh stale OUT rows so callers never see a due-date-passed loan
    // still labelled OUT.
    await assetRepository.markOverdue(new Date());

    const where: Prisma.AssetLoanWhereInput = {};
    if (query.assetId) where.assetId = query.assetId;
    if (query.householdId) where.householdId = query.householdId;
    if (query.memberId) where.memberId = query.memberId;
    if (query.eventId) where.eventId = query.eventId;
    if (query.status) where.status = query.status;
    if (query.overdueOnly) where.status = 'OVERDUE';

    const scoped = await scopeLoanFilter(user, where);
    const { skip, take } = toSkipTake(query);
    const [items, total] = await assetRepository.listLoans(scoped, skip, take);
    return { items, total, page: query.page, pageSize: query.pageSize };
  },

  async getLoanById(user: AuthUser, loanId: string) {
    const loan = await assetRepository.findLoanById(loanId);
    if (!loan) throw notFound('Loan not found');

    const scopedHouseholdId = await resolveScopedHouseholdId(user);
    if (scopedHouseholdId !== null && loan.householdId !== scopedHouseholdId) throw forbidden();
    return loan;
  },

  /** A household requests to borrow N units of an asset. */
  async requestLoan(user: AuthUser, assetId: string, input: CreateLoanInput) {
    const asset = await assetRepository.exists(assetId);
    if (!asset) throw notFound('Asset not found');
    if (asset.status !== 'AVAILABLE') {
      throw badRequest('This asset is not available for loan');
    }

    const onLoan = await assetRepository.committedQuantity(assetId);
    const available = asset.quantity - onLoan;
    if (input.quantity > available) {
      throw badRequest(`Only ${Math.max(available, 0)} ${asset.unit}(s) available`);
    }

    const borrower = await resolveBorrower(user, {
      householdId: input.householdId,
      memberId: input.memberId,
    });

    const data: Prisma.AssetLoanCreateInput = {
      asset: { connect: { id: assetId } },
      quantity: input.quantity,
      status: 'REQUESTED',
      dueAt: input.dueAt,
      depositAmount: input.depositAmount,
      feeAmount: input.feeAmount,
      currency: input.currency ?? asset.currency,
      notes: input.notes,
    };
    if (borrower.householdId) data.household = { connect: { id: borrower.householdId } };
    if (borrower.memberId) data.member = { connect: { id: borrower.memberId } };
    if (input.eventId) data.event = { connect: { id: input.eventId } };

    return assetRepository.createLoan(data);
  },

  /** Leader/treasurer approves a request; units are reserved from here on. */
  async approveLoan(user: AuthUser, loanId: string, input: ApproveLoanInput) {
    const loan = await assetRepository.findLoanById(loanId);
    if (!loan) throw notFound('Loan not found');
    if (loan.status !== 'REQUESTED') throw badRequest('Only a requested loan can be approved');

    // Re-check availability at approval time — other requests may have been
    // approved since this one was filed.
    const onLoan = await assetRepository.committedQuantity(loan.assetId, loanId);
    const asset = await assetRepository.exists(loan.assetId);
    if (!asset) throw notFound('Asset not found');
    if (loan.quantity > asset.quantity - onLoan) {
      throw badRequest(`Only ${Math.max(asset.quantity - onLoan, 0)} ${asset.unit}(s) available`);
    }

    return assetRepository.updateLoan(loanId, {
      status: 'APPROVED',
      dueAt: input.dueAt ?? loan.dueAt,
      approvedBy: { connect: { id: user.id } },
      notes: input.notes ?? loan.notes,
    });
  },

  /** Units physically leave the store room. */
  async checkoutLoan(loanId: string, input: CheckoutLoanInput) {
    const loan = await assetRepository.findLoanById(loanId);
    if (!loan) throw notFound('Loan not found');
    if (loan.status !== 'APPROVED') throw badRequest('Only an approved loan can be checked out');

    const checkedOutAt = input.checkedOutAt ?? new Date();
    const overdueAlready = loan.dueAt !== null && loan.dueAt < checkedOutAt;

    return assetRepository.updateLoan(loanId, {
      status: overdueAlready ? 'OVERDUE' : 'OUT',
      checkedOutAt,
      notes: input.notes ?? loan.notes,
    });
  },

  /**
   * Record a return. Partial returns are supported: the loan stays OUT (or
   * OVERDUE) until every unit is back.
   */
  async returnLoan(loanId: string, input: ReturnLoanInput) {
    const loan = await assetRepository.findLoanById(loanId);
    if (!loan) throw notFound('Loan not found');
    if (loan.status === 'RETURNED') throw badRequest('This loan is already fully returned');
    if (loan.status === 'LOST') throw badRequest('This loan was written off as lost');
    if (loan.status === 'REQUESTED') throw badRequest('This loan has not been checked out yet');

    const remaining = outstanding(loan);
    const returning = input.quantityReturned ?? remaining;
    if (returning > remaining) {
      throw badRequest(`Only ${remaining} unit(s) are still out on this loan`);
    }

    const quantityReturned = loan.quantityReturned + returning;
    const fullyReturned = quantityReturned >= loan.quantity;
    const returnedAt = input.returnedAt ?? new Date();

    const data: Prisma.AssetLoanUpdateInput = {
      quantityReturned,
      conditionOnReturn: input.conditionOnReturn ?? loan.conditionOnReturn,
      notes: input.notes ?? loan.notes,
    };
    if (fullyReturned) {
      data.status = 'RETURNED';
      data.returnedAt = returnedAt;
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.assetLoan.update({
        where: { id: loanId },
        data,
        include: {
          asset: {
            select: { id: true, nameHmong: true, nameLatin: true, unit: true, category: true },
          },
          household: { select: { id: true, name: true } },
          member: { select: { id: true, nameHmong: true, nameLatin: true } },
          event: { select: { id: true, title: true, startAt: true } },
          approvedBy: { select: { id: true, email: true } },
        },
      });
      // Gear that comes back damaged should not silently stay "GOOD" in the
      // register — the condition the borrower reported wins.
      if (input.conditionOnReturn) {
        await tx.asset.update({
          where: { id: loan.assetId },
          data: {
            condition: input.conditionOnReturn,
            ...(input.conditionOnReturn === 'DAMAGED' ? { status: 'UNDER_REPAIR' } : {}),
          },
        });
      }
      return updated;
    });
  },

  /**
   * Record that units cannot be returned. `Asset.quantity` is deliberately
   * left ALONE: writing off stock is a separate, explicit edit to the
   * register, so shrinkage is never silent. Closing the loan is enough to
   * release the units from the availability calculation.
   */
  async markLost(loanId: string, input: MarkLostLoanInput) {
    const loan = await assetRepository.findLoanById(loanId);
    if (!loan) throw notFound('Loan not found');
    if (loan.status === 'RETURNED') throw badRequest('This loan is already fully returned');
    if (loan.status === 'LOST') throw badRequest('This loan is already marked lost');

    return assetRepository.updateLoan(loanId, {
      status: 'LOST',
      notes: loan.notes ? `${loan.notes}\n${input.reason}` : input.reason,
    });
  },

  /**
   * Withdraw a loan that never left the store room. There is no REJECTED
   * status in the schema and nothing physically moved, so the row is removed
   * rather than parked in a state that would keep reserving units.
   */
  async cancelLoan(user: AuthUser, loanId: string) {
    const loan = await assetRepository.findLoanById(loanId);
    if (!loan) throw notFound('Loan not found');
    if (loan.status !== 'REQUESTED' && loan.status !== 'APPROVED') {
      throw badRequest('Only a loan that has not been checked out can be cancelled');
    }
    // A member may withdraw their own request; staff may cancel any.
    const scopedHouseholdId = await resolveScopedHouseholdId(user);
    if (scopedHouseholdId !== null && loan.householdId !== scopedHouseholdId) throw forbidden();

    await assetRepository.deleteLoan(loanId);
    return { message: 'Loan cancelled' };
  },
};
