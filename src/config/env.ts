function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL"),
  holdTtlSeconds: Number(process.env.HOLD_TTL_SECONDS ?? 600),
  seatMapCacheMs: Number(process.env.SEAT_MAP_CACHE_MS ?? 1000),
};
