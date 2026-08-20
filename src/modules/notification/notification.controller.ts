import type { Request, Response } from 'express';
import { unauthorized } from '../../utils/errors';
import { notificationService } from './notification.service';

export const notificationController = {
  async list(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await notificationService.list(req.user.id, req.query as never));
  },

  async unreadCount(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json({ unread: await notificationService.countUnread(req.user.id) });
  },

  async markRead(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await notificationService.markRead(req.user.id, req.params.id));
  },

  async markAllRead(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await notificationService.markAllRead(req.user.id));
  },
};
