import type { FastifyInstance } from "fastify";
import { confirmSchema, holdSchema, releaseSchema } from "./holds.schema.ts";
import { confirmHold, holdSeats, releaseHeldSeats } from "./holds.service.ts";

export async function holdsRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string }; Body: { seatIds: string[]; userId: string } }>(
    "/shows/:id/hold",
    { schema: holdSchema },
    async (req, reply) => {
      const hold = await holdSeats(req.params.id, req.body.userId, req.body.seatIds);
      return reply.code(201).send(hold);
    },
  );

  app.post<{ Params: { holdId: string }; Headers: { "idempotency-key": string } }>(
    "/holds/:holdId/confirm",
    { schema: confirmSchema },
    (req) => confirmHold(req.params.holdId, req.headers["idempotency-key"]),
  );

  app.delete<{ Params: { holdId: string } }>(
    "/holds/:holdId",
    { schema: releaseSchema },
    async (req, reply) => {
      await releaseHeldSeats(req.params.holdId);
      return reply.code(204).send();
    },
  );
}
