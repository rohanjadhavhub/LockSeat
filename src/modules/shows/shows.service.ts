import { env } from "../../config/env.ts";
import { AppError } from "../../shared/errors.ts";
import { findHeldSeatIds, findSeats, findShows } from "./shows.repository.ts";
import type { SeatMap, Show } from "./shows.types.ts";

export async function listShows(): Promise<Show[]> {
  const rows = await findShows();
  return rows.map((r) => ({ id: r.id, name: r.name, startsAt: r.starts_at.toISOString() }));
}

// shortcut: per-process cache, so each instance may serve a map up to 1s old. Upgrade to Redis cache if exact sharing is needed.
const cache = new Map<string, { expiresAt: number; value: SeatMap }>();

export async function getSeatMap(showId: string): Promise<SeatMap> {
  const hit = cache.get(showId);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const rows = await findSeats(showId);
  if (rows.length === 0) throw new AppError(404, "SHOW_NOT_FOUND", "Show not found");

  const held = await findHeldSeatIds(
    showId,
    rows.filter((r) => !r.booked).map((r) => r.seat_id),
  );
  const value: SeatMap = {
    showId,
    seats: rows.map((r) => ({
      seatId: r.seat_id,
      status: r.booked ? "booked" : held.has(r.seat_id) ? "held" : "available",
    })),
  };
  cache.set(showId, { expiresAt: Date.now() + env.seatMapCacheMs, value });
  return value;
}
