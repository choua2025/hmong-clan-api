import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../../types/express';
import { householdRepository } from './household.repository';
import { badRequest, notFound } from '../../utils/errors';
import { assertHouseholdAccess, resolveScopedHouseholdId } from '../../utils/scope';
import { toSkipTake } from '../../utils/validators';
import type {
  CreateHouseholdInput,
  ListHouseholdQuery,
  UpdateHouseholdInput,
} from './household.schema';

export const householdService = {
  async list(user: AuthUser, query: ListHouseholdQuery) {
    const where: Prisma.HouseholdWhereInput = {};

    // A MEMBER only ever sees their own household.
    const scopedHouseholdId = await resolveScopedHouseholdId(user);
    if (scopedHouseholdId) where.id = scopedHouseholdId;

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { address: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const { skip, take } = toSkipTake(query);
    const [items, total] = await householdRepository.list(where, skip, take);
    return { items, total, page: query.page, pageSize: query.pageSize };
  },

  async getById(user: AuthUser, id: string) {
    await assertHouseholdAccess(user, id);
    const household = await householdRepository.findById(id);
    if (!household) throw notFound('Household not found');
    return household;
  },

  async create(input: CreateHouseholdInput) {
    return householdRepository.create({
      name: input.name,
      address: input.address,
      contact: input.contact,
      notes: input.notes,
    });
  },

  async update(id: string, input: UpdateHouseholdInput) {
    const existing = await householdRepository.findById(id);
    if (!existing) throw notFound('Household not found');

    // If setting a head, it must be a member of this household.
    if (input.headMemberId) {
      const belongs = await householdRepository.memberBelongsTo(input.headMemberId, id);
      if (!belongs) throw badRequest('Head must be a member of this household');
    }

    const data: Prisma.HouseholdUpdateInput = {
      name: input.name,
      address: input.address,
      contact: input.contact,
      notes: input.notes,
    };
    if (input.headMemberId !== undefined) {
      data.headMember = input.headMemberId
        ? { connect: { id: input.headMemberId } }
        : { disconnect: true };
    }

    return householdRepository.update(id, data);
  },

  async remove(id: string) {
    const existing = await householdRepository.findById(id);
    if (!existing) throw notFound('Household not found');
    await householdRepository.delete(id);
  },
};
