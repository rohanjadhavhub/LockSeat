import { randomUUID } from "node:crypto";
import { env } from "../../config/env.ts";
import { AppError } from "../../shared/errors.ts";
import {
  confirmBooking,
  createHold,
  dropHoldRecord,
  findIdempotentResult,
  findKnownSeats,
  getHold,
  releaseHold,
} from "./holds.repository.ts";
import type { ConfirmResult, HoldResult } from "./holds.types.ts";

export async function holdSeats(showId: string, userId: string, seatIds: string[]): Promise<HoldResult> {
  const known = await findKnownSeats(showId, seatIds);
  if (known.length !== seatIds.length) {
    throw new AppError(404, "SEAT_NOT_FOUND", "Show or one of the seats does not exist");
  }
  const booked = known.find((s) => s.booked);
  if (booked) throw new AppError(409, "SEAT_UNAVAILABLE", `Seat ${booked.seat_id} is already booked`);

  const hold = { holdId: randomUUID(), showId, userId, seatIds };
  const blocked = await createHold(hold, env.holdTtlSeconds);
  if (blocked) throw new AppError(409, "SEAT_UNAVAILABLE", `Seat ${blocked} is held by someone else`);

  return { ...hold, expiresAt: new Date(Date.now() + env.holdTtlSeconds * 1000).toISOString() };
}

export async function confirmHold(holdId: string, idempotencyKey: string): Promise<ConfirmResult> {
  const replay = await findIdempotentResult(idempotencyKey);
  if (replay) return replay;

  const hold = await getHold(holdId);
  if (!hold) {
    // The first request with this key may have just finished and dropped the hold.
    const late = await findIdempotentResult(idempotencyKey);
    if (late) return late;
    throw new AppError(410, "HOLD_EXPIRED", "Hold expired or does not exist");
  }

  // fake payment: always succeeds
  const { result, replayed } = await confirmBooking(idempotencyKey, hold);
  if (!replayed) await dropHoldRecord(holdId);
  return result;
}

export async function releaseHeldSeats(holdId: string): Promise<void> {
  const hold = await getHold(holdId);
  if (!hold) throw new AppError(404, "HOLD_NOT_FOUND", "Hold expired or does not exist");
  await releaseHold(hold);
}
