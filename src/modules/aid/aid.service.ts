import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../../types/express';
import { aidRepository } from './aid.repository';
import { notificationService } from '../notification/notification.service';
import { badRequest, notFound } from '../../utils/errors';
import { resolveDonor } from '../../utils/scope';
import { toSkipTake } from '../../utils/validators';
import { env } from '../../config/env';
import type { ContributeInput, CreateAidCaseInput, ListAidCaseQuery } from './aid.schema';

export const aidService = {
  async list(query: ListAidCaseQuery) {
    const where: Prisma.MutualAidCaseWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.affectedHouseholdId) where.affectedHouseholdId = query.affectedHouseholdId;

    const { skip, take } = toSkipTake(query);
    const [items, total] = await aidRepository.list(where, skip, take);
    return { items, total, page: query.page, pageSize: query.pageSize };
  },

  /** Case detail with the auditable confirmed total and the list of givers. */
  async getById(id: string) {
    const aidCase = await aidRepository.findById(id);
    if (!aidCase) throw notFound('Mutual-aid case not found');
    const totalRaised = await aidRepository.sumConfirmed(id);
    return { ...aidCase, totalRaised };
  },

  /** Leader opens a case for an affected household. */
  async create(user: AuthUser, input: CreateAidCaseInput) {
    const aidCase = await aidRepository.create({
      affectedHousehold: { connect: { id: input.affectedHouseholdId } },
      type: input.type,
      title: input.title,
      description: input.description,
      targetAmount: input.targetAmount,
      currency: input.currency ?? env.defaultCurrency,
      status: 'OPEN',
      openedBy: { connect: { id: user.id } },
    });
    await notificationService.publish({
      type: 'MUTUAL_AID',
      title: `New mutual-aid case: ${aidCase.title}`,
      body: aidCase.description,
      linkUrl: `/aid-cases/${aidCase.id}`,
      createdById: user.id,
    });
    return aidCase;
  },

  /** A member (or staff on their behalf) contributes to an open case. */
  async contribute(user: AuthUser, caseId: string, input: ContributeInput) {
    const aidCase = await aidRepository.findById(caseId);
    if (!aidCase) throw notFound('Mutual-aid case not found');
    if (aidCase.status !== 'OPEN') throw badRequest('This case is closed to contributions');

    const donor = await resolveDonor(user, {
      householdId: input.householdId,
      memberId: input.memberId,
    });
    const currency = input.currency ?? aidCase.currency;

    const data: Prisma.AidContributionCreateInput = {
      case: { connect: { id: caseId } },
      amount: input.amount,
      currency,
      // Backed by a PENDING payment; a treasurer confirms before it counts
      // toward the total (claude.md §5).
      payment: {
        create: {
          amount: input.ocrAmount ?? input.amount,
          currency,
          slipUrl: input.slipUrl,
          reference: input.reference,
          ocrAmount: input.ocrAmount,
          ocrRaw: input.ocrRaw,
          status: 'PENDING',
        },
      },
    };
    if (donor.householdId) data.household = { connect: { id: donor.householdId } };
    if (donor.memberId) data.member = { connect: { id: donor.memberId } };

    return aidRepository.createContribution(data);
  },

  /** Leader closes a case. */
  async close(id: string) {
    const aidCase = await aidRepository.findById(id);
    if (!aidCase) throw notFound('Mutual-aid case not found');
    if (aidCase.status === 'CLOSED') throw badRequest('This case is already closed');
    return aidRepository.update(id, { status: 'CLOSED', closedAt: new Date() });
  },
};
