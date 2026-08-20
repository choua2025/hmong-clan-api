import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env';

/**
 * Single shared PrismaClient instance. In dev, `tsx watch` reloads the module
 * graph on change; cache the client on globalThis so we don't exhaust the
 * connection pool by creating a new client per reload.
 *
 * Prisma 7 connects through a driver adapter; the connection string comes from
 * the validated env config (see src/config/env.ts), not schema.prisma.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaPg({ connectionString: env.databaseUrl });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: env.isProduction ? ['error'] : ['query', 'warn', 'error'],
  });

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}
