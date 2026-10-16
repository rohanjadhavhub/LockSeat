import type { FastifyInstance } from "fastify";
import { seatsSchema } from "./shows.schema.ts";
import { getSeatMap, listShows } from "./shows.service.ts";

export async function showsRoutes(app: FastifyInstance) {
  app.get("/shows", () => listShows());

  app.get<{ Params: { id: string } }>("/shows/:id/seats", { schema: seatsSchema }, (req) =>
    getSeatMap(req.params.id),
  );
}
