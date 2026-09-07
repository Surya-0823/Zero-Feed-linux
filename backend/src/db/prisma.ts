import { PrismaClient } from '@prisma/client';
import { config } from '../config/env';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

let _prismaInstance: PrismaClient | null = null;

function getPrismaClient(): PrismaClient {
  if (!_prismaInstance) {
    _prismaInstance =
      globalForPrisma.prisma ||
      new PrismaClient({
        datasources: {
          db: {
            url: config.databaseUrl,
          },
        },
        log: config.nodeEnv === 'development' ? ['query', 'error', 'warn'] : ['error'],
      });
    if (config.nodeEnv !== 'production') globalForPrisma.prisma = _prismaInstance;
  }
  return _prismaInstance;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

