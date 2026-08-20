import type { Request, Response } from 'express';
import { memberService } from './member.service';
import { unauthorized } from '../../utils/errors';

export const memberController = {
  async list(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await memberService.list(req.user, req.query as never));
  },

  async getById(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await memberService.getById(req.user, req.params.id));
  },

  async create(req: Request, res: Response) {
    res.status(201).json(await memberService.create(req.body));
  },

  async update(req: Request, res: Response) {
    res.json(await memberService.update(req.params.id, req.body));
  },

  async remove(req: Request, res: Response) {
    await memberService.remove(req.params.id);
    res.status(204).send();
  },
};
