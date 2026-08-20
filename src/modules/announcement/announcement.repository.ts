import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const include = {
  author: { select: { id: true, email: true } },
} satisfies Prisma.AnnouncementInclude;

export const announcementRepository = {
  list(where: Prisma.AnnouncementWhereInput, skip: number, take: number) {
    return prisma.$transaction([
      prisma.announcement.findMany({
        where,
        skip,
        take,
        // Pinned first, then most recent.
        orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
        include,
      }),
      prisma.announcement.count({ where }),
    ]);
  },

  findById(id: string) {
    return prisma.announcement.findUnique({ where: { id }, include });
  },

  create(data: Prisma.AnnouncementCreateInput) {
    return prisma.announcement.create({ data, include });
  },

  update(id: string, data: Prisma.AnnouncementUpdateInput) {
    return prisma.announcement.update({ where: { id }, data, include });
  },

  delete(id: string) {
    return prisma.announcement.delete({ where: { id } });
  },
};
