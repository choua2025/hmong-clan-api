import { z } from 'zod';
import { dateSchema, paginationSchema } from '../../utils/validators';

export const OFFICE_POSITIONS = [
  'PRESIDENT',
  'VICE_PRESIDENT',
  'SECRETARY',
  'TREASURER',
  'COMMITTEE_MEMBER',
  'ADVISOR',
] as const;

export const officePositionSchema = z.enum(OFFICE_POSITIONS);

export const createOfficeTermSchema = z
  .object({
    memberId: z.string().uuid(),
    position: officePositionSchema,
    titleHmong: z.string().max(200).optional(),
    titleLao: z.string().max(200).optional(),
    startedAt: dateSchema,
    endedAt: dateSchema.optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((v) => !v.endedAt || v.endedAt >= v.startedAt, {
    message: 'End date must be on or after the start date',
    path: ['endedAt'],
  });

export const updateOfficeTermSchema = z
  .object({
    position: officePositionSchema.optional(),
    titleHmong: z.string().max(200).nullable().optional(),
    titleLao: z.string().max(200).nullable().optional(),
    startedAt: dateSchema.optional(),
    endedAt: dateSchema.nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const listOfficeTermQuerySchema = paginationSchema.extend({
  position: officePositionSchema.optional(),
  memberId: z.string().uuid().optional(),
  // Default view is the sitting committee; pass current=false for past terms.
  current: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

/** Ending a term records when it ended; defaults to now. */
export const endOfficeTermSchema = z.object({
  endedAt: dateSchema.optional(),
  notes: z.string().max(2000).optional(),
});

export const officeTermIdParam = z.object({ id: z.string().uuid() });

export type CreateOfficeTermInput = z.infer<typeof createOfficeTermSchema>;
export type UpdateOfficeTermInput = z.infer<typeof updateOfficeTermSchema>;
export type ListOfficeTermQuery = z.infer<typeof listOfficeTermQuerySchema>;
export type EndOfficeTermInput = z.infer<typeof endOfficeTermSchema>;
