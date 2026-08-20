import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../../types/express';
import { announcementRepository } from './announcement.repository';
import { notificationService } from '../notification/notification.service';
import { notFound } from '../../utils/errors';
import { isStaff } from '../../utils/scope';
import { toSkipTake } from '../../utils/validators';
import type {
  CreateAnnouncementInput,
  ListAnnouncementQuery,
  UpdateAnnouncementInput,
} from './announcement.schema';

/** Only published announcements are visible to ordinary members. */
function publishedFilter(): Prisma.AnnouncementWhereInput {
  return { publishedAt: { not: null, lte: new Date() } };
}

export const announcementService = {
  async list(user: AuthUser, query: ListAnnouncementQuery) {
    const where: Prisma.AnnouncementWhereInput = {};
    if (!isStaff(user)) Object.assign(where, publishedFilter());
    if (query.pinned !== undefined) where.pinned = query.pinned;

    const { skip, take } = toSkipTake(query);
    const [items, total] = await announcementRepository.list(where, skip, take);
    return { items, total, page: query.page, pageSize: query.pageSize };
  },

  async getById(user: AuthUser, id: string) {
    const announcement = await announcementRepository.findById(id);
    if (!announcement) throw notFound('Announcement not found');
    // Hide unpublished drafts from non-staff.
    if (!isStaff(user) && (!announcement.publishedAt || announcement.publishedAt > new Date())) {
      throw notFound('Announcement not found');
    }
    return announcement;
  },

  async create(user: AuthUser, input: CreateAnnouncementInput) {
    const announcement = await announcementRepository.create({
      title: input.title,
      body: input.body,
      pinned: input.pinned ?? false,
      publishedAt: input.publish ? new Date() : null,
      author: { connect: { id: user.id } },
    });
    if (announcement.publishedAt) {
      await notificationService.publish({
        type: 'ANNOUNCEMENT',
        title: `New announcement: ${announcement.title}`,
        body: announcement.body,
        linkUrl: '/announcements',
        createdById: user.id,
      });
    }
    return announcement;
  },

  async update(id: string, input: UpdateAnnouncementInput) {
    const existing = await announcementRepository.findById(id);
    if (!existing) throw notFound('Announcement not found');

    const data: Prisma.AnnouncementUpdateInput = {
      title: input.title,
      body: input.body,
      pinned: input.pinned,
    };
    // `publish` toggles publication state explicitly when provided.
    if (input.publish === true && !existing.publishedAt) data.publishedAt = new Date();
    if (input.publish === false) data.publishedAt = null;

    const updated = await announcementRepository.update(id, data);
    if (input.publish === true && !existing.publishedAt && updated.publishedAt) {
      await notificationService.publish({
        type: 'ANNOUNCEMENT',
        title: `New announcement: ${updated.title}`,
        body: updated.body,
        linkUrl: '/announcements',
        createdById: updated.authorId,
      });
    }
    return updated;
  },

  async remove(id: string) {
    const existing = await announcementRepository.findById(id);
    if (!existing) throw notFound('Announcement not found');
    await announcementRepository.delete(id);
  },
};
