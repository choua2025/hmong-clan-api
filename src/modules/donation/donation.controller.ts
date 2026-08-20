import type { Request, Response } from 'express';
import { donationService } from './donation.service';
import { unauthorized } from '../../utils/errors';

export const donationController = {
  async list(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await donationService.list(req.user, req.query as never));
  },

  async getById(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await donationService.getById(req.user, req.params.id));
  },

  async create(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.status(201).json(await donationService.create(req.user, req.body));
  },
};
