import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const include = {
  uploadedBy: { select: { id: true, email: true } },
} satisfies Prisma.DocumentInclude;

export const documentRepository = {
  list(where: Prisma.DocumentWhereInput, skip: number, take: number) {
    return prisma.$transaction([
      prisma.document.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include,
      }),
      prisma.document.count({ where }),
    ]);
  },

  findById(id: string) {
    return prisma.document.findUnique({ where: { id }, include });
  },

  create(data: Prisma.DocumentCreateInput) {
    return prisma.document.create({ data, include });
  },

  update(id: string, data: Prisma.DocumentUpdateInput) {
    return prisma.document.update({ where: { id }, data, include });
  },

  delete(id: string) {
    return prisma.document.delete({ where: { id } });
  },
};
