import { Request, Response } from 'express';
import { prisma } from '../db/prisma';

export class HealthController {
  async getHealth(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    let databaseStatus = 'disconnected';
    let dbLatencyMs: number | null = null;

    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - dbStart;
      databaseStatus = 'connected';
    } catch (error) {
      databaseStatus = 'error';
    }

    const isHealthy = databaseStatus === 'connected';
    const statusCode = isHealthy ? 200 : 503;

    res.status(statusCode).json({
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      services: {
        api: 'running',
        database: {
          status: databaseStatus,
          latencyMs: dbLatencyMs,
        },
      },
      durationMs: Date.now() - startTime,
    });
  }
}

export const healthController = new HealthController();
