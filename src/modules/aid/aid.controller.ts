import type { Request, Response } from 'express';
import { aidService } from './aid.service';
import { unauthorized } from '../../utils/errors';

export const aidController = {
  async list(req: Request, res: Response) {
    res.json(await aidService.list(req.query as never));
  },

  async getById(req: Request, res: Response) {
    res.json(await aidService.getById(req.params.id));
  },

  async create(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.status(201).json(await aidService.create(req.user, req.body));
  },

  async contribute(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.status(201).json(await aidService.contribute(req.user, req.params.id, req.body));
  },

  async close(req: Request, res: Response) {
    res.json(await aidService.close(req.params.id));
  },
};
