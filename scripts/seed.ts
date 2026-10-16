import { readFile } from "node:fs/promises";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const rows = "ABCDEFGHIJ".split("");
const seatIds = rows.flatMap((r) => Array.from({ length: 10 }, (_, i) => `${r}${i + 1}`));

await pool.query(await readFile(new URL("./schema.sql", import.meta.url), "utf8"));
await pool.query(
  "INSERT INTO shows (id, name, starts_at) VALUES ('demo', 'Demo Show', now() + interval '1 day') ON CONFLICT DO NOTHING",
);
await pool.query(
  "INSERT INTO seats (show_id, seat_id) SELECT 'demo', unnest($1::text[]) ON CONFLICT DO NOTHING",
  [seatIds],
);
console.log(`Seeded show "demo" with ${seatIds.length} seats`);
await pool.end();
