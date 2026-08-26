import type { OfficePosition, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const termInclude = {
  member: {
    select: {
      id: true,
      nameHmong: true,
      nameLatin: true,
      photoUrl: true,
      household: { select: { id: true, name: true } },
      user: { select: { id: true, email: true, role: true } },
    },
  },
  appointedBy: { select: { id: true, email: true } },
} satisfies Prisma.OfficeTermInclude;

export type OfficeTermRecord = Prisma.OfficeTermGetPayload<{ include: typeof termInclude }>;

export const officerRepository = {
  list(where: Prisma.OfficeTermWhereInput, skip: number, take: number) {
    return prisma.$transaction([
      prisma.officeTerm.findMany({
        where,
        skip,
        take,
        // Sitting terms first (currentSeat non-null sorts before null with
        // nulls: 'last'), then most recently started.
        orderBy: [{ currentSeat: { sort: 'asc', nulls: 'last' } }, { startedAt: 'desc' }],
        include: termInclude,
      }),
      prisma.officeTerm.count({ where }),
    ]);
  },

  findById(id: string) {
    return prisma.officeTerm.findUnique({ where: { id }, include: termInclude });
  },

  /** Every sitting term, in protocol order. Backs the committee board. */
  listSitting() {
    return prisma.officeTerm.findMany({
      where: { currentSeat: { not: null } },
      orderBy: [{ position: 'asc' }, { startedAt: 'asc' }],
      include: termInclude,
    });
  },

  /** Sitting holders of one position (several, for the multi-holder seats). */
  findSittingByPosition(position: OfficePosition) {
    return prisma.officeTerm.findMany({
      where: { position, currentSeat: { not: null } },
      orderBy: { startedAt: 'asc' },
      include: termInclude,
    });
  },

  /** Is this member already sitting in this office? Backs rule R3. */
  findSittingFor(position: OfficePosition, memberId: string) {
    return prisma.officeTerm.findFirst({
      where: { position, memberId, currentSeat: { not: null } },
      select: { id: true },
    });
  },

  create(data: Prisma.OfficeTermCreateInput) {
    return prisma.officeTerm.create({ data, include: termInclude });
  },

  update(id: string, data: Prisma.OfficeTermUpdateInput) {
    return prisma.officeTerm.update({ where: { id }, data, include: termInclude });
  },

  delete(id: string) {
    return prisma.officeTerm.delete({ where: { id } });
  },

  /**
   * Seat a holder in a SINGLE-holder office, retiring the incumbent in the same
   * transaction so the seat is never doubly held nor briefly empty. Clearing
   * `currentSeat` on the outgoing row must happen before the insert, or the new
   * row collides with the unique index.
   */
  handover(position: OfficePosition, endedAt: Date, data: Prisma.OfficeTermCreateInput) {
    return prisma.$transaction(async (tx) => {
      await tx.officeTerm.updateMany({
        where: { position, currentSeat: { not: null } },
        data: { currentSeat: null, endedAt },
      });
      return tx.officeTerm.create({ data, include: termInclude });
    });
  },
};
