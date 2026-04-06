import Redis from 'ioredis';
import { config } from './env';

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null, // required for BullMQ
  enableReadyCheck: false,
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});
