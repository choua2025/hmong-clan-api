import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../../types/express';
import { memberRepository } from './member.repository';
import { badRequest, notFound } from '../../utils/errors';
import { assertHouseholdAccess, resolveScopedHouseholdId } from '../../utils/scope';
import { toSkipTake } from '../../utils/validators';
import type { CreateMemberInput, ListMemberQuery, UpdateMemberInput } from './member.schema';

export const memberService = {
  async list(user: AuthUser, query: ListMemberQuery) {
    const where: Prisma.MemberWhereInput = {};

    // Members are confined to their own household; staff may filter freely.
    const scopedHouseholdId = await resolveScopedHouseholdId(user);
    if (scopedHouseholdId) {
      where.householdId = scopedHouseholdId;
    } else if (query.householdId) {
      where.householdId = query.householdId;
    }

    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { nameHmong: { contains: query.search, mode: 'insensitive' } },
        { nameLatin: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const { skip, take } = toSkipTake(query);
    const [items, total] = await memberRepository.list(where, skip, take);
    return { items, total, page: query.page, pageSize: query.pageSize };
  },

  async getById(user: AuthUser, id: string) {
    const member = await memberRepository.findById(id);
    if (!member) throw notFound('Member not found');
    await assertHouseholdAccess(user, member.householdId);
    return member;
  },

  async create(input: CreateMemberInput) {
    const household = await memberRepository.householdExists(input.householdId);
    if (!household) throw badRequest('Household does not exist');

    return memberRepository.create({
      household: { connect: { id: input.householdId } },
      nameHmong: input.nameHmong,
      nameLatin: input.nameLatin,
      gender: input.gender,
      dob: input.dob,
      photoUrl: input.photoUrl,
      status: input.status ?? 'ACTIVE',
    });
  },

  async update(id: string, input: UpdateMemberInput) {
    const existing = await memberRepository.findById(id);
    if (!existing) throw notFound('Member not found');

    if (input.householdId && input.householdId !== existing.householdId) {
      const household = await memberRepository.householdExists(input.householdId);
      if (!household) throw badRequest('Household does not exist');
    }

    const data: Prisma.MemberUpdateInput = {
      nameHmong: input.nameHmong,
      nameLatin: input.nameLatin,
      gender: input.gender,
      dob: input.dob,
      photoUrl: input.photoUrl,
      status: input.status,
    };
    if (input.householdId && input.householdId !== existing.householdId) {
      data.household = { connect: { id: input.householdId } };
    }

    return memberRepository.update(id, data);
  },

  async remove(id: string) {
    const existing = await memberRepository.findById(id);
    if (!existing) throw notFound('Member not found');
    await memberRepository.delete(id);
  },
};
