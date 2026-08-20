import type { Request, Response } from 'express';
import { householdService } from './household.service';
import { unauthorized } from '../../utils/errors';

export const householdController = {
  async list(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await householdService.list(req.user, req.query as never));
  },

  async getById(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await householdService.getById(req.user, req.params.id));
  },

  async create(req: Request, res: Response) {
    res.status(201).json(await householdService.create(req.body));
  },

  async update(req: Request, res: Response) {
    res.json(await householdService.update(req.params.id, req.body));
  },

  async remove(req: Request, res: Response) {
    await householdService.remove(req.params.id);
    res.status(204).send();
  },
};
