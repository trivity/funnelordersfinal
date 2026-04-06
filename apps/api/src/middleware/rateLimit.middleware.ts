import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../lib/redis';

function makeStore(prefix: string) {
  return new RedisStore({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendCommand: ((...args: any[]) => (redis as any).call(...args)) as any,
    prefix,
  });
}

export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('rl:global:'),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('rl:auth:'),
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
});

export const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('rl:admin:'),
});

export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('rl:webhook:'),
  keyGenerator: (req) => (req.params['userId'] as string) ?? req.ip ?? 'unknown',
});
