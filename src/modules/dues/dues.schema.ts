import { z } from 'zod';
import { dateSchema, moneySchema, optionalMoneySchema, paginationSchema } from '../../utils/validators';

export const createDuesSchema = z.object({
  householdId: z.string().uuid(),
  period: z.string().min(1).max(20), // e.g. "2026" or "2026-Q1"
  amount: moneySchema,
  currency: z.string().length(3).optional(), // ISO 4217, defaults to env
  dueDate: dateSchema.optional(),
});

export const listDuesQuerySchema = paginationSchema.extend({
  householdId: z.string().uuid().optional(),
  status: z.enum(['UNPAID', 'PENDING', 'PAID', 'WAIVED']).optional(),
  period: z.string().max(20).optional(),
});

/**
 * Submitting proof of transfer for a dues charge. `ocrAmount`/`ocrRaw` are
 * ADVISORY values from QR/OCR scanning — they are never trusted as the real
 * amount; the treasurer must confirm (claude.md §5).
 */
export const payDuesSchema = z.object({
  slipUrl: z.string().url().max(1000),
  reference: z.string().max(200).optional(),
  ocrAmount: optionalMoneySchema,
  ocrRaw: z.string().max(5000).optional(),
});

/** Treasurer confirms a payment — the human-verified amount is authoritative. */
export const confirmDuesSchema = z.object({
  amount: moneySchema,
});

export const rejectDuesSchema = z.object({
  reason: z.string().min(1).max(500),
});

export const duesIdParam = z.object({ id: z.string().uuid() });

export type CreateDuesInput = z.infer<typeof createDuesSchema>;
export type ListDuesQuery = z.infer<typeof listDuesQuerySchema>;
export type PayDuesInput = z.infer<typeof payDuesSchema>;
export type ConfirmDuesInput = z.infer<typeof confirmDuesSchema>;
export type RejectDuesInput = z.infer<typeof rejectDuesSchema>;
