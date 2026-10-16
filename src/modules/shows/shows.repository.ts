import { pool } from "../../bootstrap/postgres.ts";
import { redis } from "../../bootstrap/redis.ts";

export interface SeatRow {
  seat_id: string;
  booked: boolean;
}

export async function findShows() {
  const { rows } = await pool.query<{ id: string; name: string; starts_at: Date }>(
    "SELECT id, name, starts_at FROM shows ORDER BY starts_at",
  );
  return rows;
}

export async function findSeats(showId: string): Promise<SeatRow[]> {
  const { rows } = await pool.query<SeatRow>(
    `SELECT s.seat_id, (b.seat_id IS NOT NULL) AS booked
       FROM seats s
       LEFT JOIN bookings b ON b.show_id = s.show_id AND b.seat_id = s.seat_id
      WHERE s.show_id = $1
      ORDER BY s.seat_id`,
    [showId],
  );
  return rows;
}

export async function findHeldSeatIds(showId: string, seatIds: string[]): Promise<Set<string>> {
  if (seatIds.length === 0) return new Set();
  const values = await redis.mget(seatIds.map((id) => `seat:${showId}:${id}`));
  return new Set(seatIds.filter((_, i) => values[i] !== null));
}
