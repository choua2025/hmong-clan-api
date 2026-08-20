import { z } from 'zod';
import { paginationSchema } from '../../utils/validators';

export const createHouseholdSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  contact: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateHouseholdSchema = createHouseholdSchema.partial().extend({
  address: z.string().max(500).nullable().optional(),
  contact: z.string().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  // Set/clear the head; must be a member of this household (enforced in service).
  headMemberId: z.string().uuid().nullable().optional(),
});

export const listHouseholdQuerySchema = paginationSchema.extend({
  search: z.string().trim().min(1).optional(),
});

export const householdIdParam = z.object({ id: z.string().uuid() });

export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;
export type UpdateHouseholdInput = z.infer<typeof updateHouseholdSchema>;
export type ListHouseholdQuery = z.infer<typeof listHouseholdQuerySchema>;
