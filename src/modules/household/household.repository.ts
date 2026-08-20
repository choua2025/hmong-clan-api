import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const memberSummary = {
  select: { id: true, nameHmong: true, nameLatin: true, status: true, photoUrl: true },
} satisfies Prisma.Household$membersArgs;

export const householdRepository = {
  list(where: Prisma.HouseholdWhereInput, skip: number, take: number) {
    return prisma.$transaction([
      prisma.household.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: {
          headMember: { select: { id: true, nameHmong: true, nameLatin: true } },
          _count: { select: { members: true } },
        },
      }),
      prisma.household.count({ where }),
    ]);
  },

  findById(id: string) {
    return prisma.household.findUnique({
      where: { id },
      include: {
        headMember: { select: { id: true, nameHmong: true, nameLatin: true } },
        members: memberSummary,
      },
    });
  },

  create(data: Prisma.HouseholdCreateInput) {
    return prisma.household.create({ data });
  },

  update(id: string, data: Prisma.HouseholdUpdateInput) {
    return prisma.household.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.household.delete({ where: { id } });
  },

  /** Whether a member belongs to a given household (used for head validation). */
  async memberBelongsTo(memberId: string, householdId: string): Promise<boolean> {
    const member = await prisma.member.findFirst({
      where: { id: memberId, householdId },
      select: { id: true },
    });
    return member !== null;
  },
};
