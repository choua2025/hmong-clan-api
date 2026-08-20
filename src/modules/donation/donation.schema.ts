import { z } from 'zod';
import { moneySchema, optionalMoneySchema, paginationSchema } from '../../utils/validators';

export const createDonationSchema = z.object({
  // Donor: at least one of these. Non-staff are forced to themselves in the service.
  householdId: z.string().uuid().optional(),
  memberId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  amount: moneySchema,
  currency: z.string().length(3).optional(),
  note: z.string().max(1000).optional(),
  // Proof of transfer. OCR fields are advisory only (claude.md §5).
  slipUrl: z.string().url().max(1000).optional(),
  reference: z.string().max(200).optional(),
  ocrAmount: optionalMoneySchema,
  ocrRaw: z.string().max(5000).optional(),
});

export const listDonationQuerySchema = paginationSchema.extend({
  householdId: z.string().uuid().optional(),
  memberId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'REJECTED']).optional(),
});

export const donationIdParam = z.object({ id: z.string().uuid() });

export type CreateDonationInput = z.infer<typeof createDonationSchema>;
export type ListDonationQuery = z.infer<typeof listDonationQuerySchema>;
