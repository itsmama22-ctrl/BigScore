/**
 * Simple in-memory rate limiter for server actions and API routes.
 *
 * For production with multiple Vercel instances, replace this with:
 *   - Vercel KV (upstash/ratelimit)
 *   - Redis-backed rate limiter
 *   - Firebase Firestore-backed limiter
 *
 * This implementation is suitable for development and small-scale
 * production where a single server instance handles requests.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Periodically clean up expired entries to prevent memory leaks
if (typeof globalThis !== "undefined") {
  const cleanupInterval = 60_000; // 1 minute
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetAt) {
        store.delete(key);
      }
    }
  }, cleanupInterval);
}

export interface RateLimitOptions {
  /** Maximum number of requests allowed within the window. */
  maxRequests: number;
  /** Time window in milliseconds. */
  windowMs: number;
  /** Unique identifier for the rate limit key. */
  key: string;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check if a request should be rate limited.
 *
 * @example
 * ```ts
 * const result = rateLimit({
 *   maxRequests: 5,
 *   windowMs: 60_000,
 *   key: `login:${email}`,
 * });
 *
 * if (!result.success) {
 *   throw new Error("Too many attempts. Try again later.");
 * }
 * ```
 */
export function rateLimit(options: RateLimitOptions): RateLimitResult {
  const { maxRequests, windowMs, key } = options;
  const now = Date.now();

  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // First request or window expired — reset
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { success: true, remaining: maxRequests - 1, resetAt };
  }

  if (entry.count >= maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  entry.count += 1;
  return {
    success: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Sensitive endpoints and their rate limits.
 */
export const rateLimits = {
  login: { maxRequests: 10, windowMs: 60_000 }, // 10 login attempts per minute
  invite: { maxRequests: 5, windowMs: 300_000 }, // 5 invites per 5 minutes
  sendNotification: { maxRequests: 10, windowMs: 60_000 },
  upload: { maxRequests: 20, windowMs: 60_000 },
  delete: { maxRequests: 10, windowMs: 60_000 },
} as const;

export type RateLimitKey = keyof typeof rateLimits;

/**
 * Convenience wrapper that applies a named rate limit.
 * Returns the result — callers decide how to handle failure.
 */
export function applyRateLimit(
  name: RateLimitKey,
  identity: string
): RateLimitResult {
  const config = rateLimits[name];
  return rateLimit({
    maxRequests: config.maxRequests,
    windowMs: config.windowMs,
    key: `${name}:${identity}`,
  });
}
