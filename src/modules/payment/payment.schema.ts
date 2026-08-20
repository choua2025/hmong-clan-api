import { z } from 'zod';
import { moneySchema, paginationSchema } from '../../utils/validators';

export const listPaymentQuerySchema = paginationSchema.extend({
  status: z.enum(['PENDING', 'CONFIRMED', 'REJECTED']).optional(),
});

/** Treasurer confirms a payment with the human-verified amount (claude.md §5). */
export const confirmPaymentSchema = z.object({
  amount: moneySchema,
});

export const rejectPaymentSchema = z.object({
  reason: z.string().min(1).max(500),
});

export const paymentIdParam = z.object({ id: z.string().uuid() });

export type ListPaymentQuery = z.infer<typeof listPaymentQuerySchema>;
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;
export type RejectPaymentInput = z.infer<typeof rejectPaymentSchema>;
