import http from 'node:http';
import { buildApp } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';

async function startServer(): Promise<void> {
  const app = await buildApp();
  let bridgeServer: http.Server | null = null;

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}. Shutting down gracefully...`);
    try {
      if (bridgeServer) {
        bridgeServer.close();
      }
      await app.close();
      await prisma.$disconnect();
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    const address = await app.listen({
      port: config.PORT,
      host: config.HOST,
    });
    app.log.info(`Server listening at ${address}`);

    // If main server is on port 3001, also bind port 4000 directly using the same routing engine
    // for seamless dual-port compatibility (whether client connects to 3001 or 4000)
    if (config.PORT !== 4000) {
      try {
        bridgeServer = http.createServer(app.routing);

        bridgeServer.on('error', (err: any) => {
          app.log.warn(`Port 4000 compatibility listener could not be bound: ${err.message}`);
        });

        bridgeServer.listen(4000, config.HOST, () => {
          app.log.info(`Port 4000 compatibility listener active -> serving DEVOS API on http://${config.HOST}:4000`);
        });
      } catch (err) {
        app.log.warn(`Failed to initialize port 4000 compatibility listener: ${err}`);
      }
    }
  } catch (err) {
    app.log.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

