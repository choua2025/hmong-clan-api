import type { OfficePosition, Prisma } from '@prisma/client';
import type { AuthUser } from '../../types/express';
import { prisma } from '../../lib/prisma';
import { officerRepository } from './officer.repository';
import { notificationService } from '../notification/notification.service';
import { badRequest, notFound } from '../../utils/errors';
import { toSkipTake } from '../../utils/validators';
import { OFFICE_POSITIONS } from './officer.schema';
import type {
  CreateOfficeTermInput,
  EndOfficeTermInput,
  ListOfficeTermQuery,
  UpdateOfficeTermInput,
} from './officer.schema';

/**
 * A term is "sitting" when isCurrent is true. Because the schema enforces
 * @@unique([position, isCurrent]), a retired term must store NULL rather than
 * false — Postgres considers NULLs distinct, so many retired terms per
 * position coexist while only one may sit.
 */
const RETIRED = null;

async function assertMemberExists(memberId: string) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, status: true },
  });
  if (!member) throw notFound('Member not found');
  if (member.status !== 'ACTIVE') {
    throw badRequest('Only an active member can hold office');
  }
}

export const officerService = {
  async list(query: ListOfficeTermQuery) {
    const where: Prisma.OfficeTermWhereInput = {};
    if (query.position) where.position = query.position;
    if (query.memberId) where.memberId = query.memberId;
    if (query.current !== undefined) {
      where.isCurrent = query.current ? true : null;
    }

    const { skip, take } = toSkipTake(query);
    const [items, total] = await officerRepository.list(where, skip, take);
    return { items, total, page: query.page, pageSize: query.pageSize };
  },

  /**
   * The committee board: one entry per position in protocol order, with the
   * sitting holder or null where the seat is vacant.
   */
  async board() {
    const [items] = await officerRepository.list({ isCurrent: true }, 0, OFFICE_POSITIONS.length * 20);
    return OFFICE_POSITIONS.map((position) => ({
      position,
      // COMMITTEE_MEMBER and ADVISOR are seats many people can hold at once,
      // but the unique constraint allows only one *current* row per position,
      // so this stays a single holder for every seat.
      holder: items.find((t) => t.position === position) ?? null,
    }));
  },

  async getById(id: string) {
    const term = await officerRepository.findById(id);
    if (!term) throw notFound('Office term not found');
    return term;
  },

  /**
   * Appoint a member to a position. If the seat is occupied, the incumbent's
   * term is closed at the new term's start date in the same transaction.
   */
  async create(user: AuthUser, input: CreateOfficeTermInput) {
    await assertMemberExists(input.memberId);

    // A term created with an end date is a historical record, not a sitting one.
    const sitting = !input.endedAt;

    const data: Prisma.OfficeTermCreateInput = {
      member: { connect: { id: input.memberId } },
      position: input.position,
      titleHmong: input.titleHmong,
      titleLao: input.titleLao,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      isCurrent: sitting ? true : RETIRED,
      appointedBy: { connect: { id: user.id } },
      notes: input.notes,
    };

    if (!sitting) return officerRepository.create(data);

    const term = await officerRepository.appoint(input.position, input.startedAt, data);
    await notificationService.publish({
      type: 'SYSTEM',
      title: `New ${input.position.toLowerCase().replace(/_/g, ' ')}: ${term.member.nameLatin}`,
      body: term.notes,
      linkUrl: '/officers',
      createdById: user.id,
    });
    return term;
  },

  async update(id: string, input: UpdateOfficeTermInput) {
    const existing = await officerRepository.findById(id);
    if (!existing) throw notFound('Office term not found');

    // Moving a sitting term to another position would collide with that
    // position's incumbent; require ending it and appointing afresh.
    if (input.position && input.position !== existing.position && existing.isCurrent) {
      throw badRequest('End this term before moving the member to another position');
    }

    const startedAt = input.startedAt ?? existing.startedAt;
    const endedAt = input.endedAt === undefined ? existing.endedAt : input.endedAt;
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
    // Setting an end date retires the term; clearing it does NOT auto-reinstate,
    // since another member may already hold the seat.
    if (input.endedAt !== undefined) {
      data.endedAt = input.endedAt;
      if (input.endedAt !== null) data.isCurrent = RETIRED;
    }

    return officerRepository.update(id, data);
  },

  /** Close a sitting term, leaving the seat vacant. */
  async end(id: string, input: EndOfficeTermInput) {
    const term = await officerRepository.findById(id);
    if (!term) throw notFound('Office term not found');
    if (!term.isCurrent) throw badRequest('This term has already ended');

    const endedAt = input.endedAt ?? new Date();
    if (endedAt < term.startedAt) {
      throw badRequest('End date must be on or after the start date');
    }

    return officerRepository.update(id, {
      endedAt,
      isCurrent: RETIRED,
      notes: input.notes ?? term.notes,
    });
  },

  async remove(id: string) {
    const term = await officerRepository.findById(id);
    if (!term) throw notFound('Office term not found');
    await officerRepository.delete(id);
    return { message: 'Office term deleted' };
  },

  /** Sitting holder of a single position (used by the board and reports). */
  async currentFor(position: OfficePosition) {
    return officerRepository.findCurrentByPosition(position);
  },
};
