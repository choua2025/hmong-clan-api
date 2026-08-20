import { z } from 'zod';
import { paginationSchema, dateSchema } from '../../utils/validators';

const genderSchema = z.enum(['MALE', 'FEMALE', 'OTHER']);
const memberStatusSchema = z.enum(['ACTIVE', 'DECEASED', 'MOVED']);

export const createMemberSchema = z.object({
  householdId: z.string().uuid(),
  nameHmong: z.string().min(1).max(200),
  nameLatin: z.string().min(1).max(200),
  gender: genderSchema.optional(),
  dob: dateSchema.optional(),
  photoUrl: z.string().url().max(1000).optional(),
  status: memberStatusSchema.optional(),
});

export const updateMemberSchema = createMemberSchema.partial().extend({
  householdId: z.string().uuid().optional(),
  gender: genderSchema.nullable().optional(),
  dob: dateSchema.nullable().optional(),
  photoUrl: z.string().url().max(1000).nullable().optional(),
  status: memberStatusSchema.optional(),
});

export const listMemberQuerySchema = paginationSchema.extend({
  householdId: z.string().uuid().optional(),
  status: memberStatusSchema.optional(),
  search: z.string().trim().min(1).optional(),
});

export const memberIdParam = z.object({ id: z.string().uuid() });

export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type ListMemberQuery = z.infer<typeof listMemberQuerySchema>;
