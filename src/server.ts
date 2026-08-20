import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";

async function main() {
  // Fail fast if the database is unreachable.
  await prisma.$connect();
  console.log("[server] database connection successful");
  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(
      `[server] listening on http://localhost:${env.port} (${env.nodeEnv})`,
    );
  });

  const shutdown = async (signal: string) => {
    console.log(`\n[server] ${signal} received, shutting down...`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch(async (err) => {
  console.error("[server] failed to start", err);
  await prisma.$disconnect();
  process.exit(1);
});
