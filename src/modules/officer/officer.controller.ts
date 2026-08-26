import type { Request, Response } from 'express';
import { officerService } from './officer.service';
import { unauthorized } from '../../utils/errors';

export const officerController = {
  async list(req: Request, res: Response) {
    res.json(await officerService.list(req.query as never));
  },

  async board(_req: Request, res: Response) {
    // board() already returns { positions, actingPresident, totalSitting }.
    res.json(await officerService.board());
  },

  async getById(req: Request, res: Response) {
    res.json(await officerService.getById(req.params.id));
  },

  async create(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.status(201).json(await officerService.create(req.user, req.body));
  },

  async update(req: Request, res: Response) {
    res.json(await officerService.update(req.params.id, req.body));
  },

  async end(req: Request, res: Response) {
    res.json(await officerService.end(req.params.id, req.body));
  },

  async remove(req: Request, res: Response) {
    res.json(await officerService.remove(req.params.id));
  },
};
