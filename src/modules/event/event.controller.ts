import type { Request, Response } from "express";
import { eventService } from "./event.service";
import { unauthorized } from "../../utils/errors";

export const eventController = {
  async list(req: Request, res: Response) {
    res.json(await eventService.list(req.query as never));
  },

  async getById(req: Request, res: Response) {
    res.json(await eventService.getById(req.params.id));
  },

  async create(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.status(201).json(await eventService.create(req.user, req.body));
  },

  async update(req: Request, res: Response) {
    res.json(await eventService.update(req.params.id, req.body));
  },

  async remove(req: Request, res: Response) {
    await eventService.remove(req.params.id);
    res.status(204).send();
  },

  async rsvp(req: Request, res: Response) {
    if (!req.user) throw unauthorized();

    const result = await eventService.rsvp(req.user, req.params.id, req.body);

    res.json(result);
  },

  async addAttendee(req: Request, res: Response) {
    res
      .status(201)
      .json(await eventService.addAttendee(req.params.id, req.body));
  },
};
