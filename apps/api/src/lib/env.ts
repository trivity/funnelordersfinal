import * as env from 'env-var';

export const config = {
  NODE_ENV: env.get('NODE_ENV').default('development').asString(),
  PORT: env.get('PORT').default('3001').asPortNumber(),
  DATABASE_URL: env.get('DATABASE_URL').required().asString(),
  REDIS_URL: env.get('REDIS_URL').required().asString(),
  JWT_ACCESS_SECRET: env.get('JWT_ACCESS_SECRET').required().asString(),
  JWT_REFRESH_SECRET: env.get('JWT_REFRESH_SECRET').required().asString(),
  STRIPE_SECRET_KEY: env.get('STRIPE_SECRET_KEY').required().asString(),
  STRIPE_WEBHOOK_SECRET: env.get('STRIPE_WEBHOOK_SECRET').required().asString(),
  STRIPE_PRICE_STARTER: env.get('STRIPE_PRICE_STARTER').required().asString(),
  STRIPE_PRICE_AGENCY: env.get('STRIPE_PRICE_AGENCY').required().asString(),
  APP_URL: env.get('APP_URL').default('http://localhost:3000').asString(),
  API_URL: env.get('API_URL').default('http://localhost:3001').asString(),
  ENCRYPTION_KEY: env.get('ENCRYPTION_KEY').required().asString(),
  RESEND_API_KEY: env.get('RESEND_API_KEY').default('').asString(),
};
