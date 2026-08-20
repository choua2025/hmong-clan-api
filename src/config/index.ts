
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
} as const satisfies Record<string, readonly Role[]>;

