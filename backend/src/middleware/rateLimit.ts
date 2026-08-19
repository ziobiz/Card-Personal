import { Request, Response, NextFunction } from 'express';

const buckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX = Number(process.env.PARTNER_RATE_LIMIT_PER_MIN ?? 300);

export function partnerRateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = req.partner?.id ?? req.ip ?? 'anon';
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, b);
  }
  b.count += 1;
  res.setHeader('X-RateLimit-Limit', String(MAX));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, MAX - b.count)));
  if (b.count > MAX) {
    res.status(429).json({ error: 'Rate limit exceeded', retryAfterMs: b.resetAt - now });
    return;
  }
  next();
}
