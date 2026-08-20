import { z } from 'zod';
import { dateSchema, paginationSchema } from '../../utils/validators';

const eventType = z.enum(['NEW_YEAR', 'MEETING', 'WEDDING', 'FUNERAL', 'CEREMONY', 'OTHER']);

export const createEventSchema = z
  .object({
    title: z.string().min(1).max(200),
    titleLao: z.string().max(200).optional(),
    type: eventType.default('OTHER'),
    description: z.string().max(2000).optional(),
    location: z.string().max(300).optional(),
    startAt: dateSchema,
    endAt: dateSchema.optional(),
  })
  .refine((v) => !v.endAt || v.endAt >= v.startAt, {
    message: 'endAt must be on or after startAt',
    path: ['endAt'],
  });

export const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  titleLao: z.string().max(200).optional(),
  type: eventType.optional(),
  description: z.string().max(2000).optional(),
  location: z.string().max(300).optional(),
  startAt: dateSchema.optional(),
  endAt: dateSchema.optional(),
});

export const listEventQuerySchema = paginationSchema.extend({
  type: eventType.optional(),
  upcoming: z.coerce.boolean().optional(),
});

/** A member RSVPs for themselves. */
export const rsvpSchema = z.object({
  status: z.enum(['GOING', 'DECLINED']),
});

/** Staff add/mark an attendee. */
export const addAttendeeSchema = z.object({
  memberId: z.string().uuid(),
  status: z.enum(['INVITED', 'GOING', 'DECLINED', 'ATTENDED']).default('INVITED'),
});

export const eventIdParam = z.object({ id: z.string().uuid() });

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type ListEventQuery = z.infer<typeof listEventQuerySchema>;
export type RsvpInput = z.infer<typeof rsvpSchema>;
export type AddAttendeeInput = z.infer<typeof addAttendeeSchema>;
