import type { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export interface CreateNotificationData {
  type: NotificationType;
  title: string;
  body?: string | null;
  linkUrl?: string | null;
  createdById?: string | null;
}

export const notificationRepository = {
  listForUser(userId: string, where: Prisma.NotificationWhereInput, skip: number, take: number) {
    return prisma.$transaction([
      prisma.notification.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          readBy: {
            where: { userId },
            select: { readAt: true },
            take: 1,
          },
          createdBy: { select: { id: true, email: true } },
        },
      }),
      prisma.notification.count({ where }),
    ]);
  },

  countUnread(userId: string) {
    return prisma.notification.count({
      where: { readBy: { none: { userId } } },
    });
  },

  findById(id: string) {
    return prisma.notification.findUnique({ where: { id }, select: { id: true } });
  },

  create(data: CreateNotificationData) {
    return prisma.notification.create({
      data: {
        type: data.type,
        title: data.title,
        body: data.body,
        linkUrl: data.linkUrl,
        createdBy: data.createdById ? { connect: { id: data.createdById } } : undefined,
      },
    });
  },

  markRead(userId: string, notificationId: string) {
    return prisma.notificationRead.upsert({
      where: { notificationId_userId: { notificationId, userId } },
      create: { notificationId, userId },
      update: { readAt: new Date() },
    });
  },

  async markAllRead(userId: string) {
    const unread = await prisma.notification.findMany({
      where: { readBy: { none: { userId } } },
      select: { id: true },
    });
    if (unread.length === 0) return { count: 0 };

    const result = await prisma.notificationRead.createMany({
      data: unread.map((notification) => ({ notificationId: notification.id, userId })),
      skipDuplicates: true,
    });
    return { count: result.count };
  },
};
