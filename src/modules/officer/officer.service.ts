import type { OfficePosition, Prisma, Role } from '@prisma/client';
import type { AuthUser } from '../../types/express';
import { prisma } from '../../lib/prisma';
import { officerRepository, type OfficeTermRecord } from './officer.repository';
import { notificationService } from '../notification/notification.service';
import { badRequest, conflict, notFound } from '../../utils/errors';
import { toSkipTake } from '../../utils/validators';
import { OFFICE_POSITIONS } from './officer.schema';
import type {
  CreateOfficeTermInput,
  EndOfficeTermInput,
  ListOfficeTermQuery,
  UpdateOfficeTermInput,
} from './officer.schema';

/**
 * Offices held by exactly one person at a time. The other two —
 * COMMITTEE_MEMBER and ADVISOR — are the working body and the elders, and the
 * association seats as many of them as it likes.
 */
const SINGLE_SEATS = new Set<OfficePosition>([
  'PRESIDENT',
  'VICE_PRESIDENT',
  'SECRETARY',
  'TREASURER',
]);

export const isSingleSeat = (position: OfficePosition) => SINGLE_SEATS.has(position);

/**
 * The value stored in OfficeTerm.currentSeat, which is UNIQUE. A single seat
 * keys on the position alone, so a second sitting holder collides; a multi seat
 * keys on position + holder, so any number fit while one person still cannot
 * hold the same office twice at once. `null` means the term has ended.
 */
function seatKey(position: OfficePosition, memberId: string): string {
  return isSingleSeat(position) ? position : `${position}:${memberId}`;
}

/** The system Role each office is expected to carry. */
const EXPECTED_ROLE: Record<OfficePosition, Role> = {
  PRESIDENT: 'LEADER',
  VICE_PRESIDENT: 'LEADER',
  SECRETARY: 'LEADER',
  TREASURER: 'TREASURER',
  COMMITTEE_MEMBER: 'MEMBER',
  ADVISOR: 'MEMBER',
};

/**
 * `currentSeat` is a storage mechanism; callers want a boolean. Deriving it
 * here keeps the API contract stable and means there is no second column to
 * drift out of sync.
 *
 * `roleMismatch` surfaces an officer whose login lacks the role their office
 * implies. Appointment deliberately never grants roles — that stays a super
 * admin action — so this flag is how the gap stays visible instead of silent.
 */
function serialize(term: OfficeTermRecord) {
  const { currentSeat, ...rest } = term;
  const isCurrent = currentSeat !== null;
  const expectedRole = EXPECTED_ROLE[term.position];
  const actualRole = term.member.user?.role ?? null;
  return {
    ...rest,
    isCurrent,
    seatKind: isSingleSeat(term.position) ? ('SINGLE' as const) : ('MULTI' as const),
    expectedRole,
    roleMismatch:
      isCurrent && expectedRole !== 'MEMBER' && actualRole !== null && actualRole !== expectedRole
        ? { has: actualRole, needs: expectedRole }
        : null,
  };
}

async function assertAppointable(memberId: string) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, status: true },
  });
  if (!member) throw notFound('Member not found');
  // R1 — a deceased or moved member cannot take office.
  if (member.status !== 'ACTIVE') throw badRequest('Only an active member can hold office');
}

export const officerService = {
  async list(query: ListOfficeTermQuery) {
    const where: Prisma.OfficeTermWhereInput = {};
    if (query.position) where.position = query.position;
    if (query.memberId) where.memberId = query.memberId;
    if (query.current !== undefined) {
      where.currentSeat = query.current ? { not: null } : null;
    }

    const { skip, take } = toSkipTake(query);
    const [items, total] = await officerRepository.list(where, skip, take);
    return { items: items.map(serialize), total, page: query.page, pageSize: query.pageSize };
  },

  /**
   * The committee board: every office in protocol order with its sitting
   * holders. Single seats carry at most one; the committee and advisors carry
   * as many as are seated. A seat with no holders is vacant.
   */
  async board() {
    const sitting = await officerRepository.listSitting();
    const positions = OFFICE_POSITIONS.map((position) => {
      const holders = sitting.filter((t) => t.position === position).map(serialize);
      return {
        position,
        seatKind: isSingleSeat(position) ? ('SINGLE' as const) : ('MULTI' as const),
        expectedRole: EXPECTED_ROLE[position],
        holders,
        vacant: holders.length === 0,
      };
    });

    // R5 — a vacant presidency does not promote anyone. The board reports the
    // vice president as acting; no permission moves on its own.
    const president = positions.find((p) => p.position === 'PRESIDENT');
    const vice = positions.find((p) => p.position === 'VICE_PRESIDENT');
    const actingPresident =
      president?.vacant && vice && !vice.vacant ? (vice.holders[0] ?? null) : null;

    return { positions, actingPresident, totalSitting: sitting.length };
  },

  async getById(id: string) {
    const term = await officerRepository.findById(id);
    if (!term) throw notFound('Office term not found');
    return serialize(term);
  },

  /**
   * Appoint a member to an office.
   *
   * Single seat, already occupied -> handover: the incumbent is retired at the
   * successor's start date and the new term opens in one transaction (R2).
   * Multi seat -> the holder simply joins the others.
   */
  async create(user: AuthUser, input: CreateOfficeTermInput) {
    await assertAppointable(input.memberId);

    // A term created with an end date is a historical backfill, not a seating.
    const sitting = !input.endedAt;

    if (sitting) {
      // R3 — one person cannot hold the same office twice concurrently. Checked
      // here for a clear message; the unique index is the real guarantee.
      const already = await officerRepository.findSittingFor(input.position, input.memberId);
      if (already) throw conflict('This member already holds that office');
    }

    const data: Prisma.OfficeTermCreateInput = {
      member: { connect: { id: input.memberId } },
      position: input.position,
      titleHmong: input.titleHmong,
      titleLao: input.titleLao,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      currentSeat: sitting ? seatKey(input.position, input.memberId) : null,
      appointedBy: { connect: { id: user.id } },
      notes: input.notes,
    };

    if (!sitting) return serialize(await officerRepository.create(data));

    // Only a single seat displaces anyone. Seating a committee member must not
    // retire the rest of the committee.
    const term = isSingleSeat(input.position)
      ? await officerRepository.handover(input.position, input.startedAt, data)
      : await officerRepository.create(data);

    await notificationService.publish({
      type: 'SYSTEM',
      title: `${term.member.nameLatin} appointed ${input.position.toLowerCase().replace(/_/g, ' ')}`,
      body: term.notes,
      linkUrl: '/officers',
      createdById: user.id,
    });
    return serialize(term);
  },

  async update(id: string, input: UpdateOfficeTermInput) {
    const existing = await officerRepository.findById(id);
    if (!existing) throw notFound('Office term not found');
    const isCurrent = existing.currentSeat !== null;

    // Moving a sitting term to another office would have to displace that
    // office's holder; end it and appoint afresh so the handover is explicit.
    if (input.position && input.position !== existing.position && isCurrent) {
      throw badRequest('End this term before moving the member to another office');
    }

    const startedAt = input.startedAt ?? existing.startedAt;
    const endedAt = input.endedAt === undefined ? existing.endedAt : input.endedAt;
    // R4 — a term never ends before it starts.
    if (endedAt && endedAt < startedAt) {
      throw badRequest('End date must be on or after the start date');
    }

    const data: Prisma.OfficeTermUpdateInput = {
      position: input.position,
      titleHmong: input.titleHmong,
      titleLao: input.titleLao,
      startedAt: input.startedAt,
      notes: input.notes,
    };
    // Setting an end date retires the term. Clearing one does NOT reinstate it:
    // someone else may hold the seat now, so re-seating goes through appoint.
    if (input.endedAt !== undefined) {
      data.endedAt = input.endedAt;
      if (input.endedAt !== null) data.currentSeat = null;
    }

    return serialize(await officerRepository.update(id, data));
  },

  /** Close a sitting term. The seat is left vacant (R5). */
  async end(id: string, input: EndOfficeTermInput) {
    const term = await officerRepository.findById(id);
    if (!term) throw notFound('Office term not found');
    if (term.currentSeat === null) throw badRequest('This term has already ended');

    const endedAt = input.endedAt ?? new Date();
    if (endedAt < term.startedAt) {
      throw badRequest('End date must be on or after the start date');
    }

    return serialize(
      await officerRepository.update(id, {
        endedAt,
        currentSeat: null,
        notes: input.notes ?? term.notes,
      }),
    );
  },

  /**
   * R6 — retired terms are the association's leadership history and are kept.
   * Deletion exists only to correct a mistaken entry.
   */
  async remove(id: string) {
    const term = await officerRepository.findById(id);
    if (!term) throw notFound('Office term not found');
    await officerRepository.delete(id);
    return { message: 'Office term deleted' };
  },

  /** Sitting holders of one office. Used by the board and by reports. */
  async currentFor(position: OfficePosition) {
    const terms = await officerRepository.findSittingByPosition(position);
    return terms.map(serialize);
  },
};
