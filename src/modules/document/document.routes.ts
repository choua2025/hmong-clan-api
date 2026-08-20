import { Router } from 'express';
import { documentController } from './document.controller';
import {
  createDocumentSchema,
  documentIdParam,
  listDocumentQuerySchema,
  updateDocumentSchema,
} from './document.schema';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { PERMISSIONS } from '../../config';
export const documentRoutes = Router();

documentRoutes.use(authenticate);

documentRoutes.get(
  '/',
  validate({ query: listDocumentQuerySchema }),
  asyncHandler(documentController.list),
);

documentRoutes.get(
  '/:id',
  validate({ params: documentIdParam }),
  asyncHandler(documentController.getById),
);

// Leaders manage shared documents (bylaws, minutes, etc.).
documentRoutes.post(
  '/',
  authorize(...PERMISSIONS.DOCUMENT_MANAGEMENT),
  validate({ body: createDocumentSchema }),
  asyncHandler(documentController.create),
);

documentRoutes.patch(
  '/:id',
  authorize(...PERMISSIONS.DOCUMENT_MANAGEMENT),
  validate({ params: documentIdParam, body: updateDocumentSchema }),
  asyncHandler(documentController.update),
);

documentRoutes.delete(
  '/:id',
  authorize(...PERMISSIONS.DOCUMENT_MANAGEMENT),
  validate({ params: documentIdParam }),
  asyncHandler(documentController.remove),
);
