import app from './app';
import { config } from './config/env';
import { prisma } from './db/prisma';

// Trigger reload timestamp: 2026-09-07T21:17:35
const server = app.listen(config.port, () => {
  console.log(`[ZeroFeed Backend] Server running on http://localhost:${config.port} in ${config.nodeEnv} mode`);
});

const gracefulShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Gracefully shutting down...`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log('Prisma disconnected successfully.');
      process.exit(0);
    } catch (err) {
      console.error('Error disconnecting Prisma:', err);
      process.exit(1);
    }
  });

  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    console.error('Shutdown timed out. Forcing process exit.');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

export default server;
