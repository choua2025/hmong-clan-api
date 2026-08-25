
import type { Role } from '@prisma/client';

export const ROLE = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  LEADER: 'LEADER',
  TREASURER: 'TREASURER',
  MEMBER: 'MEMBER',
} as const satisfies Record<Role, Role>;

/**
 * Central RBAC role groups. `authorize()` always allows SUPER_ADMIN, so these
 * lists only need the non-super roles that own each capability.
 */
export const PERMISSIONS = {
  USER_MANAGEMENT: [ROLE.SUPER_ADMIN],
  HOUSEHOLD_MANAGEMENT: [ROLE.LEADER],
  MEMBER_MANAGEMENT: [ROLE.LEADER],
  DUES_MANAGEMENT: [ROLE.TREASURER],
  PAYMENT_CONFIRMATION: [ROLE.TREASURER],
  DONATION_MANAGEMENT: [ROLE.TREASURER],
  MUTUAL_AID_CASE_MANAGEMENT: [ROLE.LEADER],
  EVENT_MANAGEMENT: [ROLE.LEADER],
  ANNOUNCEMENT_MANAGEMENT: [ROLE.LEADER],
  DOCUMENT_MANAGEMENT: [ROLE.LEADER],
  ASSOCIATION_REPORTS: [ROLE.LEADER, ROLE.TREASURER],
  FINANCE_REPORTS: [ROLE.TREASURER],

  // Governance: who sits on the committee is a leadership decision.
  OFFICER_MANAGEMENT: [ROLE.LEADER],

  // Shared clan property: leaders own the register; either leader or
  // treasurer may approve/check out a loan (deposits and fees are money).
  ASSET_MANAGEMENT: [ROLE.LEADER],
  ASSET_LOAN_APPROVAL: [ROLE.LEADER, ROLE.TREASURER],

  // Expenses: a leader approves the spend, the treasurer disburses the cash.
  EXPENSE_APPROVAL: [ROLE.LEADER],
  EXPENSE_DISBURSEMENT: [ROLE.TREASURER],
} as const satisfies Record<string, readonly Role[]>;

