/**
 * Small in-memory fixed-window rate limiter. Belinked runs as a single process, so
 * process memory is an adequate store; limits reset on restart, which is acceptable
 * for abuse throttling (login lockout uses the database instead).
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}

/** Returns true when the action is allowed, false when the limit is exceeded. */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  sweep(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

export function resetRateLimits() {
  buckets.clear();
}
