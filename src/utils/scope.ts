import type { AuthUser } from '../types/express';
import { prisma } from '../lib/prisma';
import { forbidden } from './errors';

/** Roles that can see association-wide data. */
export const STAFF_ROLES = ['SUPER_ADMIN', 'LEADER', 'TREASURER',] as const;

export function isStaff(user: AuthUser): boolean {
  return (STAFF_ROLES as readonly string[]).includes(user.role);
}

/**
 * Resolve the household a non-staff member belongs to. Staff get `null`
 * (meaning "no restriction"). A MEMBER with no linked member record, or whose
 * member has no household, is forbidden from member-scoped data.
 */
export async function resolveScopedHouseholdId(user: AuthUser): Promise<string | null> {
  if (isStaff(user)) return null;
  if (!user.memberId) throw forbidden('Your account is not linked to a member record');
  const member = await prisma.member.findUnique({
    where: { id: user.memberId },
    select: { householdId: true },
  });
  if (!member) throw forbidden('Your account is not linked to a member record');
  return member.householdId;
}

/** Throw unless the user is staff or the resource belongs to their household. */
export async function assertHouseholdAccess(user: AuthUser, householdId: string): Promise<void> {
  const scoped = await resolveScopedHouseholdId(user);
  if (scoped === null) return; // staff
  if (scoped !== householdId) throw forbidden();
}

export interface DonorRef {
  householdId?: string | undefined;
  memberId?: string | undefined;
}

/**
 * Resolve who a contribution/donation is attributed to.
 *
 * - Staff may attribute to any household/member (at least one is required).
 * - A non-staff member may only give as themselves: their own member record
 *   and household, regardless of what was sent.
 */
export async function resolveDonor(user: AuthUser, input: DonorRef): Promise<DonorRef> {
  if (isStaff(user)) {
    if (!input.householdId && !input.memberId) {
      throw forbidden('A donor household or member is required');
    }
    return { householdId: input.householdId, memberId: input.memberId };
  }
  const householdId = await resolveScopedHouseholdId(user); // throws if unlinked
  return { householdId: householdId ?? undefined, memberId: user.memberId ?? undefined };
}
