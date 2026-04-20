import { getCommsPool } from "../lib/migrations.js";

/**
 * Per-bucket rolling-hour rate limiter, persisted in Postgres so it survives
 * server restarts and works across replicas. Each (key, hour-window) pair
 * holds an integer counter; we increment atomically with `ON CONFLICT`.
 */
export async function consumeRateBucket(opts: {
  key: string;
  limit: number;
  windowSeconds?: number;
}): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const windowSeconds = opts.windowSeconds ?? 3600;
  const now = new Date();
  // Floor to the start of the bucket window for a stable key.
  const windowStart = new Date(Math.floor(now.getTime() / 1000 / windowSeconds) * windowSeconds * 1000);
  const resetAt = new Date(windowStart.getTime() + windowSeconds * 1000);

  const pool = getCommsPool();
  const { rows } = await pool.query<{ count: number }>(
    `INSERT INTO comms_rate_buckets (bucket_key, window_start, count)
     VALUES ($1, $2, 1)
     ON CONFLICT (bucket_key, window_start)
     DO UPDATE SET count = comms_rate_buckets.count + 1
     RETURNING count`,
    [opts.key, windowStart],
  );
  const count = rows[0]?.count ?? 1;
  const allowed = count <= opts.limit;
  const remaining = Math.max(0, opts.limit - count);
  return { allowed, remaining, resetAt };
}

/**
 * Periodic GC — keeps the bucket table small. Caller-driven; we run it
 * opportunistically on a 1-in-100 sample so we never block a hot path.
 */
export async function gcRateBuckets(): Promise<void> {
  const pool = getCommsPool();
  await pool.query(
    `DELETE FROM comms_rate_buckets WHERE window_start < (now() - interval '7 days')`,
  );
}
