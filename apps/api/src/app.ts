import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { config } from './lib/env';
import { errorHandler } from './middleware/errorHandler.middleware';
import { globalLimiter } from './middleware/rateLimit.middleware';
import authRoutes from './routes/auth.routes';
import ordersRoutes from './routes/orders.routes';
import integrationsRoutes from './routes/integrations.routes';
import routingRulesRoutes from './routes/routing-rules.routes';
import webhooksRoutes from './routes/webhooks.routes';
import billingRoutes from './routes/billing.routes';
import userRoutes from './routes/user.routes';
import adminRoutes from './routes/admin.routes';
import storesRoutes from './routes/stores.routes';

export function createApp() {
  const app = express();

  // Trust Railway's proxy (required for rate limiting and IP detection)
  app.set('trust proxy', 1);

  // Security headers
  app.use(helmet());

  // CORS
  app.use(
    cors({
      origin: config.APP_URL,
      credentials: true,
    }),
  );

  // HTTP logging
  app.use(morgan('combined'));

  // Raw body capture for webhook signature verification
  app.use((req: Request & { rawBody?: Buffer }, _res, next) => {
    if (req.path.startsWith('/api/v1/webhooks') || req.path === '/api/v1/billing/webhook') {
      let data: Buffer[] = [];
      req.on('data', (chunk: Buffer) => data.push(chunk));
      req.on('end', () => {
        req.rawBody = Buffer.concat(data);
        next();
      });
    } else {
      next();
    }
  });

  // Body parsers (skip for raw routes — their stream is already consumed above)
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/v1/webhooks') || req.path === '/api/v1/billing/webhook') return next();
    express.json({ limit: '10mb' })(req, res, next);
  });
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Rate limiting
  app.use('/api/', globalLimiter);

  // Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/orders', ordersRoutes);
  app.use('/api/v1/integrations', integrationsRoutes);
  app.use('/api/v1/routing-rules', routingRulesRoutes);
  app.use('/api/v1/webhooks', webhooksRoutes);
  app.use('/api/v1/billing', billingRoutes);
  app.use('/api/v1/user', userRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/stores', storesRoutes);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 404
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
