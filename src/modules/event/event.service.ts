import type { Prisma } from "@prisma/client";
import type { AuthUser } from "../../types/express";
import { eventRepository } from "./event.repository";
import { notificationService } from "../notification/notification.service";
import { badRequest, forbidden, notFound } from "../../utils/errors";
import { toSkipTake } from "../../utils/validators";
import type {
  AddAttendeeInput,
  CreateEventInput,
  ListEventQuery,
  RsvpInput,
  UpdateEventInput,
} from "./event.schema";

export const eventService = {
  async list(query: ListEventQuery) {
    const where: Prisma.EventWhereInput = {};
    if (query.type) where.type = query.type;
    if (query.upcoming) where.startAt = { gte: new Date() };

    const { skip, take } = toSkipTake(query);
    const [items, total] = await eventRepository.list(where, skip, take);
    return { items, total, page: query.page, pageSize: query.pageSize };
  },

  async getById(id: string) {
    const event = await eventRepository.findById(id);
    if (!event) throw notFound("Event not found");
    return event;
  },

  async create(user: AuthUser, input: CreateEventInput) {
    const event = await eventRepository.create({
      title: input.title,
      titleLao: input.titleLao,
      type: input.type,
      description: input.description,
      location: input.location,
      startAt: input.startAt,
      endAt: input.endAt,
      createdBy: { connect: { id: user.id } },
    });
    await notificationService.publish({
      type: "EVENT",
      title: `New event: ${event.title}`,
      body: event.description,
      linkUrl: `/events/${event.id}`,
      createdById: user.id,
    });
    return event;
  },

  async update(id: string, input: UpdateEventInput) {
    const existing = await eventRepository.findById(id);
    if (!existing) throw notFound("Event not found");

    const start = input.startAt ?? existing.startAt;
    const end = input.endAt ?? existing.endAt;
    if (end && end < start)
      throw badRequest("endAt must be on or after startAt");

    return eventRepository.update(id, {
      title: input.title,
      titleLao: input.titleLao,
      type: input.type,
      description: input.description,
      location: input.location,
      startAt: input.startAt,
      endAt: input.endAt,
    });
  },

  async remove(id: string) {
    const existing = await eventRepository.findById(id);
    if (!existing) throw notFound("Event not found");
    await eventRepository.delete(id);
  },

  /** A member RSVPs for themselves. */
  async rsvp(user: AuthUser, eventId: string, input: RsvpInput) {
    if (!user.memberId) {
      throw forbidden("Your account is not linked to a member record");
    }

    const event = await eventRepository.exists(eventId);

    if (!event) {
      throw notFound("Event not found");
    }

    return eventRepository.upsertAttendee(eventId, user.memberId, input.status);
  },

  /** Staff add or mark an attendee (e.g. record who actually ATTENDED). */
  async addAttendee(eventId: string, input: AddAttendeeInput) {
    const event = await eventRepository.exists(eventId);
    if (!event) throw notFound("Event not found");
    try {
      return await eventRepository.upsertAttendee(
        eventId,
        input.memberId,
        input.status,
      );
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2003"
      ) {
        throw badRequest("Member does not exist");
      }
      throw err;
    }
  },
};
