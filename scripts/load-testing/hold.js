// k6 run scripts/load-testing/hold.js
// Many users race for the same seat. Exactly one hold must win per seat.
import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";

const BASE = __ENV.BASE_URL || "http://127.0.0.1:3000";
const SHOW = __ENV.SHOW_ID || "demo";
const won = new Counter("holds_won");

export const options = {
  scenarios: {
    race: { executor: "per-vu-iterations", vus: 200, iterations: 1, maxDuration: "30s" },
  },
  thresholds: { holds_won: ["count==1"] },
};

export default function () {
  const res = http.post(
    `${BASE}/shows/${SHOW}/hold`,
    JSON.stringify({ seatIds: ["J10"], userId: `user-${__VU}` }),
    { headers: { "Content-Type": "application/json" } },
  );
  check(res, { "201 or 409": (r) => r.status === 201 || r.status === 409 });
  if (res.status === 201) won.add(1);
}
