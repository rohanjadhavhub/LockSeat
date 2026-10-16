import { pool } from "../../bootstrap/postgres.ts";
import { redis } from "../../bootstrap/redis.ts";
import { AppError } from "../../shared/errors.ts";
import type { ConfirmResult, Hold } from "./holds.types.ts";

const seatKey = (showId: string, seatId: string) => `seat:${showId}:${seatId}`;
const holdKey = (holdId: string) => `hold:${holdId}`;

// KEYS: seat keys..., hold key. ARGV: holdId, ttl, hold json.
// Returns 0 on success, or the 1-based index of the first seat already held. Atomic: all or nothing.
const HOLD_LUA = `
for i = 1, #KEYS - 1 do
  if redis.call('EXISTS', KEYS[i]) == 1 then return i end
end
for i = 1, #KEYS - 1 do
  redis.call('SET', KEYS[i], ARGV[1], 'EX', ARGV[2])
end
redis.call('SET', KEYS[#KEYS], ARGV[3], 'EX', ARGV[2])
return 0
`;

// Only deletes seat keys that still belong to this hold.
const RELEASE_LUA = `
for i = 1, #KEYS - 1 do
  if redis.call('GET', KEYS[i]) == ARGV[1] then redis.call('DEL', KEYS[i]) end
end
redis.call('DEL', KEYS[#KEYS])
return 1
`;

export async function findKnownSeats(showId: string, seatIds: string[]) {
  const { rows } = await pool.query<{ seat_id: string; booked: boolean }>(
    `SELECT s.seat_id, (b.seat_id IS NOT NULL) AS booked
       FROM seats s
       LEFT JOIN bookings b ON b.show_id = s.show_id AND b.seat_id = s.seat_id
      WHERE s.show_id = $1 AND s.seat_id = ANY($2::text[])`,
    [showId, seatIds],
  );
  return rows;
}

/** Returns the seat id that blocked the hold, or null when the hold was created. */
export async function createHold(hold: Hold, ttlSeconds: number): Promise<string | null> {
  const keys = [...hold.seatIds.map((s) => seatKey(hold.showId, s)), holdKey(hold.holdId)];
  const blocked = (await redis.eval(
    HOLD_LUA,
    keys.length,
    ...keys,
    hold.holdId,
    ttlSeconds,
    JSON.stringify(hold),
  )) as number;
  return blocked === 0 ? null : (hold.seatIds[blocked - 1] ?? null);
}

export async function getHold(holdId: string): Promise<Hold | null> {
  const raw = await redis.get(holdKey(holdId));
  return raw ? (JSON.parse(raw) as Hold) : null;
}

export async function releaseHold(hold: Hold): Promise<void> {
  const keys = [...hold.seatIds.map((s) => seatKey(hold.showId, s)), holdKey(hold.holdId)];
  await redis.eval(RELEASE_LUA, keys.length, ...keys, hold.holdId);
}

/** Only drops the hold record. Seat keys expire by TTL, so a booked seat is never briefly free in Redis. */
export async function dropHoldRecord(holdId: string): Promise<void> {
  await redis.del(holdKey(holdId));
}

export async function findIdempotentResult(key: string): Promise<ConfirmResult | null> {
  const { rows } = await pool.query<{ response: ConfirmResult | null }>(
    "SELECT response FROM idempotency_keys WHERE key = $1",
    [key],
  );
  return rows[0]?.response ?? null;
}

export async function confirmBooking(
  key: string,
  hold: Hold,
): Promise<{ result: ConfirmResult; replayed: boolean }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // A concurrent request with the same key waits here until the first one commits.
    const claimed = await client.query(
      "INSERT INTO idempotency_keys (key, hold_id) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING",
      [key, hold.holdId],
    );
    if (claimed.rowCount === 0) {
      const prev = await client.query<{ response: ConfirmResult }>(
        "SELECT response FROM idempotency_keys WHERE key = $1",
        [key],
      );
      await client.query("COMMIT");
      return { result: prev.rows[0]!.response, replayed: true };
    }

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO bookings (show_id, seat_id, user_id, hold_id)
       SELECT $1, unnest($2::text[]), $3, $4
       RETURNING id`,
      [hold.showId, hold.seatIds, hold.userId, hold.holdId],
    );
    const result: ConfirmResult = {
      ...hold,
      status: "confirmed",
      bookingIds: inserted.rows.map((r) => r.id),
    };
    await client.query("UPDATE idempotency_keys SET response = $2 WHERE key = $1", [key, result]);
    await client.query("COMMIT");
    return { result, replayed: false };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    if ((err as { code?: string }).code === "23505") {
      throw new AppError(409, "SEAT_ALREADY_BOOKED", "One or more seats are already booked");
    }
    throw err;
  } finally {
    client.release();
  }
}
