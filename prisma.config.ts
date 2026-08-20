import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 configuration. The datasource URL for Migrate/CLI lives here
// (no longer in schema.prisma). The runtime client gets its connection via
// the pg driver adapter in src/lib/prisma.ts.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
