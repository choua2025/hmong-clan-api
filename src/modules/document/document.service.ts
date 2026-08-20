import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../../types/express';
import { documentRepository } from './document.repository';
import { notificationService } from '../notification/notification.service';
import { notFound } from '../../utils/errors';
import { toSkipTake } from '../../utils/validators';
import type {
  CreateDocumentInput,
  ListDocumentQuery,
  UpdateDocumentInput,
} from './document.schema';

export const documentService = {
  async list(query: ListDocumentQuery) {
    const where: Prisma.DocumentWhereInput = {};
    if (query.category) where.category = query.category;
    if (query.search) where.title = { contains: query.search, mode: 'insensitive' };

    const { skip, take } = toSkipTake(query);
    const [items, total] = await documentRepository.list(where, skip, take);
    return { items, total, page: query.page, pageSize: query.pageSize };
  },

  async getById(id: string) {
    const document = await documentRepository.findById(id);
    if (!document) throw notFound('Document not found');
    return document;
  },

  async create(user: AuthUser, input: CreateDocumentInput) {
    const document = await documentRepository.create({
      title: input.title,
      fileUrl: input.fileUrl,
      category: input.category,
      uploadedBy: { connect: { id: user.id } },
    });
    await notificationService.publish({
      type: 'DOCUMENT',
      title: `New document: ${document.title}`,
      body: document.category ? `Category: ${document.category}` : null,
      linkUrl: '/documents',
      createdById: user.id,
    });
    return document;
  },

  async update(id: string, input: UpdateDocumentInput) {
    const existing = await documentRepository.findById(id);
    if (!existing) throw notFound('Document not found');
    return documentRepository.update(id, {
      title: input.title,
      fileUrl: input.fileUrl,
      category: input.category,
    });
  },

  async remove(id: string) {
    const existing = await documentRepository.findById(id);
    if (!existing) throw notFound('Document not found');
    await documentRepository.delete(id);
  },
};
