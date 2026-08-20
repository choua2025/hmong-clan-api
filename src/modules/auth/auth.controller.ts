import type { Request, Response } from 'express';
import { authService } from './auth.service';
import { unauthorized } from '../../utils/errors';

export const authController = {
  async signup(req: Request, res: Response) {
    const result = await authService.signup(req.body);
    res.status(201).json(result);
  },

  async login(req: Request, res: Response) {
    const result = await authService.login(req.body);
    res.json(result);
  },

  async refresh(req: Request, res: Response) {
    const result = await authService.refresh(req.body.refreshToken);
    res.json(result);
  },

  async logout(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    await authService.logout(req.user.id);
    res.status(204).send();
  },

  async me(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await authService.me(req.user.id));
  },

  async updateProfile(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await authService.updateProfile(req.user.id, req.body));
  },

  async changePassword(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await authService.changePassword(req.user.id, req.body));
  },

  async forgotPassword(req: Request, res: Response) {
    res.json(await authService.forgotPassword(req.body.email));
  },

  async resetPassword(req: Request, res: Response) {
    res.json(await authService.resetPassword(req.body.token, req.body.password));
  },

  async listPending(_req: Request, res: Response) {
    res.json({ items: await authService.listPending() });
  },

  async verifyUser(req: Request, res: Response) {
    res.json(await authService.verifyUser(req.params.id, req.body));
  },
};
