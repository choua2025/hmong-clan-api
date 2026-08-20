import type { Request, Response } from 'express';
import { paymentService } from './payment.service';
import { unauthorized } from '../../utils/errors';

export const paymentController = {
  async list(req: Request, res: Response) {
    res.json(await paymentService.list(req.query as never));
  },

  async getById(req: Request, res: Response) {
    res.json(await paymentService.getById(req.params.id));
  },

  async confirm(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await paymentService.confirm(req.user, req.params.id, req.body.amount));
  },

  async reject(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await paymentService.reject(req.user, req.params.id, req.body.reason));
  },
};
