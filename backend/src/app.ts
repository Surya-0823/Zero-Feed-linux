import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';

import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import subscriptionRoutes from './routes/subscription.routes';
import policyRoutes from './routes/policy.routes';

const app: Express = express();

// Security and utility middleware
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Mount API routes
app.use('/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/subscription', subscriptionRoutes);
app.use('/api/v1/policy', policyRoutes);

// Root informational endpoint
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    service: 'ZeroFeed Backend API',
    status: 'running',
    docs: {
      health: '/health',
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      subscription: '/api/v1/subscription',
      policy: '/api/v1/policy',
    },
  });
});

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'NotFound',
    message: `Route ${req.method} ${req.originalUrl} does not exist.`,
  });
});

// Global Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    error: 'InternalServerError',
    message: 'An unexpected error occurred.',
  });
});

export default app;
