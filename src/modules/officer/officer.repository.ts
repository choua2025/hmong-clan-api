import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const termInclude = {
  member: {
    select: {
      id: true,
      nameHmong: true,
      nameLatin: true,
      photoUrl: true,
      household: { select: { id: true, name: true } },
    },
  },
  appointedBy: { select: { id: true, email: true } },
} satisfies Prisma.OfficeTermInclude;

export const officerRepository = {
  list(where: Prisma.OfficeTermWhereInput, skip: number, take: number) {
    return prisma.$transaction([
      prisma.officeTerm.findMany({
        where,
        skip,
        take,
        // Sitting terms first, then most recently started.
        orderBy: [{ isCurrent: 'desc' }, { startedAt: 'desc' }],
        include: termInclude,
      }),
      prisma.officeTerm.count({ where }),
    ]);
  },

  findById(id: string) {
    return prisma.officeTerm.findUnique({ where: { id }, include: termInclude });
  },

  /** The sitting holder of a position, if any. */
  findCurrentByPosition(position: Prisma.OfficeTermWhereInput['position']) {
    return prisma.officeTerm.findFirst({
      where: { position, isCurrent: true },
      include: termInclude,
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
   * Appoint a new holder for a position, retiring the incumbent in the same
   * transaction. The schema's @@unique([position, isCurrent]) means only one
   * row per position may carry isCurrent = true, so the outgoing term must be
   * flipped to NULL (not false — Postgres treats NULLs as distinct) before the
   * new row is inserted.
   */
  appoint(position: NonNullable<Prisma.OfficeTermWhereInput['position']>, endedAt: Date, data: Prisma.OfficeTermCreateInput) {
    return prisma.$transaction(async (tx) => {
      await tx.officeTerm.updateMany({
        where: { position, isCurrent: true },
        data: { isCurrent: null, endedAt },
      });
      return tx.officeTerm.create({ data, include: termInclude });
    });
  },
};
