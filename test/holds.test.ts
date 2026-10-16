// Integration test: needs Postgres and Redis up and `pnpm seed` run once (applies the schema).
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { buildApp } from "../src/app.ts";
import { pool } from "../src/bootstrap/postgres.ts";

const app = buildApp();
const showId = `t-${randomUUID().slice(0, 8)}`;
const seats = ["A1", "A2", "A3", "A4"];
let firstHoldId = "";

const hold = (seatIds: string[], userId = "u1") =>
  app.inject({ method: "POST", url: `/shows/${showId}/hold`, payload: { seatIds, userId } });
const confirm = (holdId: string, key: string) =>
  app.inject({ method: "POST", url: `/holds/${holdId}/confirm`, headers: { "idempotency-key": key } });

before(async () => {
  await pool.query("INSERT INTO shows (id, name, starts_at) VALUES ($1, 'test', now())", [showId]);
  await pool.query("INSERT INTO seats (show_id, seat_id) SELECT $1, unnest($2::text[])", [showId, seats]);
});
after(() => app.close());

describe("hold and confirm", () => {
  it("holds all seats or none", async () => {
    const first = await hold(["A1", "A2"]);
    assert.equal(first.statusCode, 201);
    firstHoldId = first.json().holdId;

    const clash = await hold(["A2", "A3"], "u2");
    assert.equal(clash.statusCode, 409);

    // A3 must not have been grabbed by the failed multi-seat hold
    const free = await hold(["A3"], "u2");
    assert.equal(free.statusCode, 201);
  });

  it("confirms once per idempotency key and books the seats", async () => {
    const { holdId } = (await hold(["A4"], "u3")).json();
    const key = randomUUID();
    const one = await confirm(holdId, key);
    const two = await confirm(holdId, key);
    assert.equal(one.statusCode, 200);
    assert.deepEqual(two.json(), one.json());

    const { rows } = await pool.query("SELECT 1 FROM bookings WHERE show_id = $1 AND seat_id = 'A4'", [showId]);
    assert.equal(rows.length, 1);

    const again = await hold(["A4"], "u4");
    assert.equal(again.statusCode, 409);
  });

  it("releases a hold early", async () => {
    const { holdId } = (await hold(["A1"], "u5")).statusCode === 409 ? { holdId: firstHoldId } : { holdId: "" };
    const res = await app.inject({ method: "DELETE", url: `/holds/${holdId}` });
    assert.equal(res.statusCode, 204);

    const again = await hold(["A1", "A2"], "u5");
    assert.equal(again.statusCode, 201);
  });
});
