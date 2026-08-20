import { Prisma } from '@prisma/client';
import { z } from 'zod';

function normalizeMoneyString(value: string): string {
  let str = value
    .trim()
    .replace(/\s+/g, '')
    .replace(/^(LAK|KIP|\u20ad)/i, '')
    .replace(/(LAK|KIP|\u20ad)$/i, '');

  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    // 100,000.50 -> 100000.50, 100.000,50 -> 100000.50
    str = str.lastIndexOf(',') > str.lastIndexOf('.')
      ? str.replace(/\./g, '').replace(',', '.')
      : str.replace(/,/g, '');
  } else if (hasComma) {
    // 100,000 -> 100000, 100,50 -> 100.50
    const parts = str.split(',');
    const last = parts.at(-1) ?? '';
    str = last.length === 3 && parts.length > 1
      ? parts.join('')
      : `${parts.slice(0, -1).join('')}.${last}`;
  } else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(str)) {
    // 100.000 -> 100000
    str = str.replace(/\./g, '');
  }

  return str;
}

/**
 * A money amount. Accepts a number or numeric string, enforces 2-decimal,
 * non-negative values, and returns a Prisma.Decimal so it maps cleanly to
 * Decimal(12,2) columns (claude.md §5 — never Float).
 */
export const moneySchema = z
  .union([z.number(), z.string()])
  .transform((v, ctx) => {
    const str = typeof v === 'number' ? v.toString() : normalizeMoneyString(v);
    if (!/^\d+(\.\d{1,2})?$/.test(str)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Amount must be a non-negative number with at most 2 decimal places',
      });
      return z.NEVER;
    }
    return new Prisma.Decimal(str);
  });

/**
 * Optional money fields commonly come from forms as an empty string. Treat
 * empty string/null as omitted, while still validating real values with the
 * same Decimal parser.
 */
export const optionalMoneySchema = z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}, moneySchema.optional());

/** ISO date string -> Date. */
export const dateSchema = z.coerce.date();

/** Standard list pagination, coerced from query strings. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

/** Compute Prisma skip/take from pagination. */
export function toSkipTake({ page, pageSize }: Pagination) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}
