import type { AttendeeStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

const eventDetailInclude = {
  createdBy: { select: { id: true, email: true } },
  attendees: {
    orderBy: { createdAt: "asc" },
    include: {
      member: { select: { id: true, nameHmong: true, nameLatin: true } },
    },
  },
  _count: { select: { attendees: true, donations: true } },
} satisfies Prisma.EventInclude;

export const eventRepository = {
  list(where: Prisma.EventWhereInput, skip: number, take: number) {
    return prisma.$transaction([
      prisma.event.findMany({
        where,
        skip,
        take,
        orderBy: { startAt: "desc" },
        include: { _count: { select: { attendees: true, donations: true } } },
      }),
      prisma.event.count({ where }),
    ]);
  },

  findById(id: string) {
    return prisma.event.findUnique({
      where: { id },
      include: eventDetailInclude,
    });
  },

  exists(id: string) {
    return prisma.event.findUnique({ where: { id }, select: { id: true } });
  },

  create(data: Prisma.EventCreateInput) {
    return prisma.event.create({ data, include: eventDetailInclude });
  },

  update(id: string, data: Prisma.EventUpdateInput) {
    return prisma.event.update({
      where: { id },
      data,
      include: eventDetailInclude,
    });
  },

  delete(id: string) {
    return prisma.event.delete({ where: { id } });
  },

  /** Create or update a member's attendance row (unique on eventId+memberId). */
  upsertAttendee(eventId: string, memberId: string, status: AttendeeStatus) {
    return prisma.eventAttendee.upsert({
      where: {
        eventId_memberId: {
          eventId,
          memberId,
        },
      },
      create: {
        eventId,
        memberId,
        status,
      },
      update: {
        status,
      },
      include: {
        member: {
          select: {
            id: true,
            nameHmong: true,
            nameLatin: true,
          },
        },
      },
    });
  },
};
