import type { Request, Response } from 'express';
import { duesService } from './dues.service';
import { unauthorized } from '../../utils/errors';

export const duesController = {
  async list(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await duesService.list(req.user, req.query as never));
  },

  async getById(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await duesService.getById(req.user, req.params.id));
  },

  async create(req: Request, res: Response) {
    res.status(201).json(await duesService.create(req.body));
  },

  async submitPayment(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.status(201).json(await duesService.submitPayment(req.user, req.params.id, req.body));
  },

  async confirmPayment(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await duesService.confirmPayment(req.user, req.params.id, req.body));
  },

  async rejectPayment(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await duesService.rejectPayment(req.user, req.params.id, req.body));
  },
};
