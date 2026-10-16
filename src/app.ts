import Fastify from "fastify";
import { pool } from "./bootstrap/postgres.ts";
import { redis } from "./bootstrap/redis.ts";
import { holdsRoutes } from "./modules/holds/holds.routes.ts";
import { showsRoutes } from "./modules/shows/shows.routes.ts";
import { AppError } from "./shared/errors.ts";

export function buildApp(opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? false });

  app.setErrorHandler((err: Error & { statusCode?: number }, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.status).send({ error: err.code, message: err.message });
    }
    if (err.statusCode && err.statusCode < 500) {
      return reply.code(err.statusCode).send({ error: "BAD_REQUEST", message: err.message });
    }
    req.log.error(err);
    return reply.code(500).send({ error: "INTERNAL", message: "Internal server error" });
  });

  app.register(showsRoutes);
  app.register(holdsRoutes);

  app.addHook("onClose", async () => {
    await pool.end();
    redis.disconnect();
  });
  return app;
}
