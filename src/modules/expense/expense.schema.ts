import { z } from 'zod';
import { dateSchema, moneySchema, paginationSchema } from '../../utils/validators';

export const EXPENSE_CATEGORIES = [
  'FOOD',
  'VENUE',
  'TRANSPORT',
  'SUPPLIES',
  'HONORARIUM',
  'UTILITIES',
  'MAINTENANCE',
  'ADMIN',
  'OTHER',
] as const;

export const expenseCategorySchema = z.enum(EXPENSE_CATEGORIES);
export const expenseStatusSchema = z.enum([
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'PAID',
  'VOID',
]);

export const createExpenseSchema = z.object({
  title: z.string().min(1).max(200),
  titleLao: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  category: expenseCategorySchema.optional(),
  amount: moneySchema,
  currency: z.string().length(3).optional(),
  incurredAt: dateSchema.optional(),
  // What the money was spent on — an event, an aid case, or an asset.
  eventId: z.string().uuid().optional(),
  aidCaseId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  payeeName: z.string().max(200).optional(),
  payeePhone: z.string().max(50).optional(),
  receiptUrl: z.string().url().max(1000).optional(),
  // Submit straight away instead of parking it as a draft.
  submit: z.boolean().optional(),
});

export const updateExpenseSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    titleLao: z.string().max(200).nullable().optional(),
    description: z.string().max(2000).nullable().optional(),
    category: expenseCategorySchema.optional(),
    amount: moneySchema.optional(),
    currency: z.string().length(3).optional(),
    incurredAt: dateSchema.optional(),
    eventId: z.string().uuid().nullable().optional(),
    aidCaseId: z.string().uuid().nullable().optional(),
    assetId: z.string().uuid().nullable().optional(),
    payeeName: z.string().max(200).nullable().optional(),
    payeePhone: z.string().max(50).nullable().optional(),
    receiptUrl: z.string().url().max(1000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const listExpenseQuerySchema = paginationSchema.extend({
  q: z.string().max(200).optional(),
  status: expenseStatusSchema.optional(),
  category: expenseCategorySchema.optional(),
  eventId: z.string().uuid().optional(),
  aidCaseId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});

export const summaryQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  eventId: z.string().uuid().optional(),
});

export const approveExpenseSchema = z.object({
  // The approver's figure is authoritative — a receipt scan is never trusted
  // on its own (claude.md §5).
  amount: moneySchema.optional(),
  approvedAt: dateSchema.optional(),
});

export const rejectExpenseSchema = z.object({
  reason: z.string().min(1).max(2000),
});

export const disburseExpenseSchema = z.object({
  disbursedAt: dateSchema.optional(),
  receiptUrl: z.string().url().max(1000).optional(),
});

export const voidExpenseSchema = z.object({
  reason: z.string().min(1).max(2000),
});

export const expenseIdParam = z.object({ id: z.string().uuid() });

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ListExpenseQuery = z.infer<typeof listExpenseQuerySchema>;
export type SummaryQuery = z.infer<typeof summaryQuerySchema>;
export type ApproveExpenseInput = z.infer<typeof approveExpenseSchema>;
export type RejectExpenseInput = z.infer<typeof rejectExpenseSchema>;
export type DisburseExpenseInput = z.infer<typeof disburseExpenseSchema>;
export type VoidExpenseInput = z.infer<typeof voidExpenseSchema>;
