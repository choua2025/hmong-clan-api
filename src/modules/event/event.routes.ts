import { Router } from 'express';
import { eventController } from './event.controller';
import {
  addAttendeeSchema,
  createEventSchema,
  eventIdParam,
  listEventQuerySchema,
  rsvpSchema,
  updateEventSchema,
} from './event.schema';
import { authenticate, authorize, requireLinkedMember } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { PERMISSIONS } from '../../config';
export const eventRoutes = Router();

eventRoutes.use(authenticate);

eventRoutes.get('/', validate({ query: listEventQuerySchema }), asyncHandler(eventController.list));
eventRoutes.get('/:id', validate({ params: eventIdParam }), asyncHandler(eventController.getById));

// Leaders manage events.
eventRoutes.post(
  '/',
  authorize(...PERMISSIONS.EVENT_MANAGEMENT),
  validate({ body: createEventSchema }),
  asyncHandler(eventController.create),
);

eventRoutes.patch(
  '/:id',
  authorize(...PERMISSIONS.EVENT_MANAGEMENT),
  validate({ params: eventIdParam, body: updateEventSchema }),
  asyncHandler(eventController.update),
);

eventRoutes.delete(
  '/:id',
  authorize(...PERMISSIONS.EVENT_MANAGEMENT),
  validate({ params: eventIdParam }),
  asyncHandler(eventController.remove),
);

// Any member RSVPs for themselves.
eventRoutes.post(
  '/:id/rsvp',
  requireLinkedMember,
  validate({ params: eventIdParam, body: rsvpSchema }),
  asyncHandler(eventController.rsvp),
);

// Staff add an attendee or mark attendance.
eventRoutes.post(
  '/:id/attendees',
  authorize(...PERMISSIONS.EVENT_MANAGEMENT),
  validate({ params: eventIdParam, body: addAttendeeSchema }),
  asyncHandler(eventController.addAttendee),
);
