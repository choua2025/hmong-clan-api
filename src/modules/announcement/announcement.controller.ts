import type { Request, Response } from 'express';
import { announcementService } from './announcement.service';
import { unauthorized } from '../../utils/errors';

export const announcementController = {
  async list(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await announcementService.list(req.user, req.query as never));
  },

  async getById(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await announcementService.getById(req.user, req.params.id));
  },

  async create(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.status(201).json(await announcementService.create(req.user, req.body));
  },

  async update(req: Request, res: Response) {
    res.json(await announcementService.update(req.params.id, req.body));
  },

  async remove(req: Request, res: Response) {
    await announcementService.remove(req.params.id);
    res.status(204).send();
  },
};
