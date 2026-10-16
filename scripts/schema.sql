CREATE TABLE IF NOT EXISTS shows (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS seats (
  show_id TEXT NOT NULL REFERENCES shows (id),
  seat_id TEXT NOT NULL,
  PRIMARY KEY (show_id, seat_id)
);

CREATE TABLE IF NOT EXISTS bookings (
  id         BIGSERIAL PRIMARY KEY,
  show_id    TEXT NOT NULL,
  seat_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  hold_id    UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (show_id, seat_id) REFERENCES seats (show_id, seat_id),
  -- final safety net: a seat can never be booked twice
  UNIQUE (show_id, seat_id)
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key        TEXT PRIMARY KEY,
  hold_id    UUID NOT NULL,
  response   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
