import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../../types/express';
import { donationRepository } from './donation.repository';
import { badRequest, notFound } from '../../utils/errors';
import { isStaff, resolveDonor, resolveScopedHouseholdId } from '../../utils/scope';
import { toSkipTake } from '../../utils/validators';
import { env } from '../../config/env';
import type { CreateDonationInput, ListDonationQuery } from './donation.schema';

export const donationService = {
  async list(user: AuthUser, query: ListDonationQuery) {
    const where: Prisma.DonationWhereInput = {};

    // Non-staff only see donations attributed to their own household/member.
    const scopedHouseholdId = await resolveScopedHouseholdId(user);
    if (scopedHouseholdId) {
      where.OR = [{ householdId: scopedHouseholdId }, { memberId: user.memberId ?? undefined }];
    } else {
      if (query.householdId) where.householdId = query.householdId;
      if (query.memberId) where.memberId = query.memberId;
    }
    if (query.eventId) where.eventId = query.eventId;
    if (query.status) where.payment = { status: query.status };

    const { skip, take } = toSkipTake(query);
    const [items, total] = await donationRepository.list(where, skip, take);
    return { items, total, page: query.page, pageSize: query.pageSize };
  },

  async getById(user: AuthUser, id: string) {
    const donation = await donationRepository.findById(id);
    if (!donation) throw notFound('Donation not found');

    if (!isStaff(user)) {
      const scopedHouseholdId = await resolveScopedHouseholdId(user);
      const owns =
        donation.householdId === scopedHouseholdId ||
        (donation.memberId !== null && donation.memberId === user.memberId);
      if (!owns) throw notFound('Donation not found');
    }
    return donation;
  },

  async create(user: AuthUser, input: CreateDonationInput) {
    const donor = await resolveDonor(user, {
      householdId: input.householdId,
      memberId: input.memberId,
    });

    const data: Prisma.DonationCreateInput = {
      amount: input.amount,
      currency: input.currency ?? env.defaultCurrency,
      note: input.note,
      // The donation is recorded together with a PENDING payment; a treasurer
      // confirms the real amount via /payments/:id/confirm before it is trusted.
      payment: {
        create: {
          amount: input.ocrAmount ?? input.amount,
          currency: input.currency ?? env.defaultCurrency,
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
    if (input.eventId) data.event = { connect: { id: input.eventId } };

    try {
      return await donationRepository.create(data);
    } catch (err) {
      // Bad foreign key (event/household/member doesn't exist).
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2025'
      ) {
        throw badRequest('Referenced household, member, or event does not exist');
      }
      throw err;
    }
  },
};
