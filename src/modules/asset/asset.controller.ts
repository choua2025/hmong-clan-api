import type { Request, Response } from 'express';
import { assetService } from './asset.service';
import type { ListLoanQuery } from './asset.schema';
import { unauthorized } from '../../utils/errors';

export const assetController = {
  async list(req: Request, res: Response) {
    res.json(await assetService.list(req.query as never));
  },

  async getById(req: Request, res: Response) {
    res.json(await assetService.getById(req.params.id));
  },

  async create(req: Request, res: Response) {
    res.status(201).json(await assetService.create(req.body));
  },

  async update(req: Request, res: Response) {
    res.json(await assetService.update(req.params.id, req.body));
  },

  async remove(req: Request, res: Response) {
    res.json(await assetService.remove(req.params.id));
  },

  async listLoans(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await assetService.listLoans(req.user, req.query as never));
  },

  async listLoansForAsset(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    // The path segment wins over any assetId in the query string.
    const query = { ...(req.query as unknown as ListLoanQuery), assetId: req.params.id };
    res.json(await assetService.listLoans(req.user, query));
  },

  async getLoanById(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await assetService.getLoanById(req.user, req.params.loanId));
  },

  async requestLoan(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.status(201).json(await assetService.requestLoan(req.user, req.params.id, req.body));
  },

  async approveLoan(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await assetService.approveLoan(req.user, req.params.loanId, req.body));
  },

  async checkoutLoan(req: Request, res: Response) {
    res.json(await assetService.checkoutLoan(req.params.loanId, req.body));
  },

  async returnLoan(req: Request, res: Response) {
    res.json(await assetService.returnLoan(req.params.loanId, req.body));
  },

  async markLost(req: Request, res: Response) {
    res.json(await assetService.markLost(req.params.loanId, req.body));
  },

  async cancelLoan(req: Request, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await assetService.cancelLoan(req.user, req.params.loanId));
  },
};
