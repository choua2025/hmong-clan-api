import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const donationInclude = {
  household: { select: { id: true, name: true } },
  member: { select: { id: true, nameHmong: true, nameLatin: true } },
  event: { select: { id: true, title: true } },
  payment: { select: { id: true, amount: true, currency: true, status: true, slipUrl: true } },
} satisfies Prisma.DonationInclude;

export const donationRepository = {
  list(where: Prisma.DonationWhereInput, skip: number, take: number) {
    return prisma.$transaction([
      prisma.donation.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: donationInclude,
      }),
      prisma.donation.count({ where }),
    ]);
  },

  findById(id: string) {
    return prisma.donation.findUnique({ where: { id }, include: donationInclude });
  },

  /** Create a donation together with its backing (PENDING) payment. */
  create(data: Prisma.DonationCreateInput) {
    return prisma.donation.create({ data, include: donationInclude });
  },
};
