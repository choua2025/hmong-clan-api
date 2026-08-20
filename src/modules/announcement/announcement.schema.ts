import { z } from 'zod';
import { paginationSchema } from '../../utils/validators';

export const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(20000),
  pinned: z.boolean().optional(),
  // When true, publish immediately (sets publishedAt = now). Otherwise a draft.
  publish: z.boolean().optional(),
});

export const updateAnnouncementSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(20000).optional(),
  pinned: z.boolean().optional(),
  publish: z.boolean().optional(),
});

export const listAnnouncementQuerySchema = paginationSchema.extend({
  pinned: z.coerce.boolean().optional(),
});

export const announcementIdParam = z.object({ id: z.string().uuid() });

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
export type ListAnnouncementQuery = z.infer<typeof listAnnouncementQuerySchema>;
