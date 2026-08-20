import { z } from 'zod';
import { paginationSchema } from '../../utils/validators';

export const createDocumentSchema = z.object({
  title: z.string().min(1).max(200),
  fileUrl: z.string().url().max(1000),
  category: z.string().max(100).optional(), // e.g. "bylaws", "minutes"
});

export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  fileUrl: z.string().url().max(1000).optional(),
  category: z.string().max(100).nullable().optional(),
});

export const listDocumentQuerySchema = paginationSchema.extend({
  category: z.string().max(100).optional(),
  search: z.string().trim().min(1).optional(),
});

export const documentIdParam = z.object({ id: z.string().uuid() });

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type ListDocumentQuery = z.infer<typeof listDocumentQuerySchema>;
