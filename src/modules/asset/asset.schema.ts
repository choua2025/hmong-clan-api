import { z } from 'zod';
import { dateSchema, optionalMoneySchema, paginationSchema } from '../../utils/validators';

export const ASSET_CATEGORIES = [
  'KITCHENWARE',
  'FURNITURE',
  'TENT',
  'SOUND_EQUIPMENT',
  'CEREMONIAL',
  'VEHICLE',
  'LAND',
  'BUILDING',
  'OTHER',
] as const;

export const assetCategorySchema = z.enum(ASSET_CATEGORIES);
export const assetConditionSchema = z.enum(['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED']);
export const assetStatusSchema = z.enum(['AVAILABLE', 'UNDER_REPAIR', 'DISPOSED']);
export const assetLoanStatusSchema = z.enum([
  'REQUESTED',
  'APPROVED',
  'OUT',
  'RETURNED',
  'OVERDUE',
  'LOST',
]);

// ── Assets ───────────────────────────────────────────────────

export const createAssetSchema = z.object({
  nameHmong: z.string().min(1).max(200),
  nameLatin: z.string().min(1).max(200),
  category: assetCategorySchema.optional(),
  description: z.string().max(2000).optional(),
  quantity: z.coerce.number().int().min(0).optional(),
  unit: z.string().min(1).max(50).optional(),
  condition: assetConditionSchema.optional(),
  status: assetStatusSchema.optional(),
  acquiredAt: dateSchema.optional(),
  acquisitionCost: optionalMoneySchema,
  currency: z.string().length(3).optional(),
  location: z.string().max(200).optional(),
  photoUrl: z.string().url().max(1000).optional(),
  serialNo: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateAssetSchema = createAssetSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const listAssetQuerySchema = paginationSchema.extend({
  q: z.string().max(200).optional(),
  category: assetCategorySchema.optional(),
  status: assetStatusSchema.optional(),
  condition: assetConditionSchema.optional(),
  // Only assets with at least one unit free to borrow right now.
  availableOnly: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

// ── Loans ────────────────────────────────────────────────────

export const createLoanSchema = z.object({
  // Borrower: staff may lend to any household/member; members borrow as
  // themselves (the service overrides these).
  householdId: z.string().uuid().optional(),
  memberId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  quantity: z.coerce.number().int().min(1).default(1),
  dueAt: dateSchema.optional(),
  depositAmount: optionalMoneySchema,
  feeAmount: optionalMoneySchema,
  currency: z.string().length(3).optional(),
  notes: z.string().max(2000).optional(),
});

export const listLoanQuerySchema = paginationSchema.extend({
  assetId: z.string().uuid().optional(),
  householdId: z.string().uuid().optional(),
  memberId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  status: assetLoanStatusSchema.optional(),
  // Out past the due date and not yet returned.
  overdueOnly: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const approveLoanSchema = z.object({
  dueAt: dateSchema.optional(),
  notes: z.string().max(2000).optional(),
});

export const checkoutLoanSchema = z.object({
  checkedOutAt: dateSchema.optional(),
  notes: z.string().max(2000).optional(),
});

export const returnLoanSchema = z.object({
  // Partial returns are allowed; omit to return everything still out.
  quantityReturned: z.coerce.number().int().min(1).optional(),
  conditionOnReturn: assetConditionSchema.optional(),
  returnedAt: dateSchema.optional(),
  notes: z.string().max(2000).optional(),
});

export const rejectLoanSchema = z.object({
  reason: z.string().min(1).max(2000),
});

export const markLostLoanSchema = z.object({
  reason: z.string().min(1).max(2000),
});

export const assetIdParam = z.object({ id: z.string().uuid() });
export const loanIdParam = z.object({ loanId: z.string().uuid() });
export const assetLoanParams = z.object({
  id: z.string().uuid(),
  loanId: z.string().uuid(),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type ListAssetQuery = z.infer<typeof listAssetQuerySchema>;
export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type ListLoanQuery = z.infer<typeof listLoanQuerySchema>;
export type ApproveLoanInput = z.infer<typeof approveLoanSchema>;
export type CheckoutLoanInput = z.infer<typeof checkoutLoanSchema>;
export type ReturnLoanInput = z.infer<typeof returnLoanSchema>;
export type RejectLoanInput = z.infer<typeof rejectLoanSchema>;
export type MarkLostLoanInput = z.infer<typeof markLostLoanSchema>;
