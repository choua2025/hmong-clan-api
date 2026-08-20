import { z } from 'zod';
import { moneySchema, optionalMoneySchema, paginationSchema } from '../../utils/validators';

export const createAidCaseSchema = z.object({
  affectedHouseholdId: z.string().uuid(),
  type: z.enum(['FUNERAL', 'EMERGENCY', 'OTHER']),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  targetAmount: optionalMoneySchema,
  currency: z.string().length(3).optional(),
});

export const listAidCaseQuerySchema = paginationSchema.extend({
  status: z.enum(['OPEN', 'CLOSED']).optional(),
  type: z.enum(['FUNERAL', 'EMERGENCY', 'OTHER']).optional(),
  affectedHouseholdId: z.string().uuid().optional(),
});

export const contributeSchema = z.object({
  // Contributor: at least one. Non-staff are forced to themselves in the service.
  householdId: z.string().uuid().optional(),
  memberId: z.string().uuid().optional(),
  amount: moneySchema,
  currency: z.string().length(3).optional(),
  slipUrl: z.string().url().max(1000).optional(),
  reference: z.string().max(200).optional(),
  ocrAmount: optionalMoneySchema,
  ocrRaw: z.string().max(5000).optional(),
});

export const aidCaseIdParam = z.object({ id: z.string().uuid() });

export type CreateAidCaseInput = z.infer<typeof createAidCaseSchema>;
export type ListAidCaseQuery = z.infer<typeof listAidCaseQuerySchema>;
export type ContributeInput = z.infer<typeof contributeSchema>;
