import type { Prisma } from '@prisma/client';
import { notFound } from '../../utils/errors';
import { toSkipTake } from '../../utils/validators';
import { notificationRepository, type CreateNotificationData } from './notification.repository';
import type { ListNotificationQuery } from './notification.schema';

function serializeNotification(item: Awaited<ReturnType<typeof notificationRepository.listForUser>>[0][number]) {
  const read = item.readBy[0];
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    body: item.body,
    linkUrl: item.linkUrl,
    createdAt: item.createdAt,
    createdBy: item.createdBy,
    isRead: !!read,
    readAt: read?.readAt ?? null,
  };
}

export const notificationService = {
  async list(userId: string, query: ListNotificationQuery) {
    const where: Prisma.NotificationWhereInput = {};
    if (query.unreadOnly) where.readBy = { none: { userId } };

    const { skip, take } = toSkipTake(query);
    const [items, total] = await notificationRepository.listForUser(userId, where, skip, take);
    const unread = await notificationRepository.countUnread(userId);

    return {
      items: items.map(serializeNotification),
      total,
      unread,
      page: query.page,
      pageSize: query.pageSize,
    };
  },

  countUnread(userId: string) {
    return notificationRepository.countUnread(userId);
  },

  async markRead(userId: string, notificationId: string) {
    const existing = await notificationRepository.findById(notificationId);
    if (!existing) throw notFound('Notification not found');
    await notificationRepository.markRead(userId, notificationId);
    return { message: 'Notification marked as read' };
  },

  markAllRead(userId: string) {
    return notificationRepository.markAllRead(userId);
  },

  publish(data: CreateNotificationData) {
    return notificationRepository.create(data);
  },
};
