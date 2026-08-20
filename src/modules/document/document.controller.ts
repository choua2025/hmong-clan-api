import type { Request, Response } from 'express';
import { documentService } from './document.service';
import { unauthorized } from '../../utils/errors';

export const documentController = {
  async list(req: Request, res: Response) {
    res.json(await documentService.list(req.query as never));
  },

  async getById(req: Request, res: Response) {
    res.json(await documentService.getById(req.params.id));
  },

  async create(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.status(201).json(await documentService.create(req.user, req.body));
  },

  async update(req: Request, res: Response) {
    res.json(await documentService.update(req.params.id, req.body));
  },

  async remove(req: Request, res: Response) {
    await documentService.remove(req.params.id);
    res.status(204).send();
  },
};
