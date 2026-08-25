import type { Request, Response } from 'express';
import { expenseService } from './expense.service';
import { unauthorized } from '../../utils/errors';

export const expenseController = {
  async list(req: Request, res: Response) {
    res.json(await expenseService.list(req.query as never));
  },

  async summary(req: Request, res: Response) {
    res.json(await expenseService.summary(req.query as never));
  },

  async getById(req: Request, res: Response) {
    res.json(await expenseService.getById(req.params.id));
  },

  async create(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.status(201).json(await expenseService.create(req.user, req.body));
  },

  async update(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await expenseService.update(req.user, req.params.id, req.body));
  },

  async submit(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await expenseService.submit(req.user, req.params.id));
  },

  async approve(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await expenseService.approve(req.user, req.params.id, req.body));
  },

  async reject(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await expenseService.reject(req.user, req.params.id, req.body));
  },

  async disburse(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await expenseService.disburse(req.user, req.params.id, req.body));
  },

  async void(req: Request, res: Response) {
    res.json(await expenseService.void(req.params.id, req.body));
  },

  async remove(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await expenseService.remove(req.user, req.params.id));
  },
};
