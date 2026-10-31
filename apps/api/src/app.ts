import fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import { AppConfig, config as defaultConfig } from './config.js';
import { errorHandler } from './errorHandler.js';
import { apiRoutes } from './routes/index.js';
import { healthRoutes } from './routes/health.js';

declare module 'fastify' {
  interface FastifyInstance {
    appConfig: AppConfig;
  }
}

export interface BuildAppOptions extends FastifyServerOptions {
  appConfig?: AppConfig;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const appConfig = options.appConfig ?? defaultConfig;

  const app = fastify({
    logger: options.logger ?? {
      level: appConfig.LOG_LEVEL,
    },
    ...options,
  });

  // Attach appConfig to Fastify instance
  app.decorate('appConfig', appConfig);

  // Gracefully handle empty or omitted JSON bodies without throwing FST_ERR_CTP_EMPTY_JSON_BODY
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body: string, done) => {
    if (!body || body.trim() === '') {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(body));
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });
  // Centralized Error Handler
  app.setErrorHandler(errorHandler);

  // NotFound Handler consistent with { error: { code, message } }
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method}:${request.url} not found`,
      },
    });
  });

  // CORS restricted to CORS_ORIGIN and FRONTEND_URL with credentials
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      // or requests where the origin matches the configured CORS_ORIGIN / FRONTEND_URL
      if (
        !origin ||
        origin === appConfig.CORS_ORIGIN ||
        origin === appConfig.FRONTEND_URL ||
        origin.startsWith('http://localhost:')
      ) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    },
    credentials: true,
  });

  // Routes folder registered under /api
  await app.register(apiRoutes, { prefix: '/api' });

  // Direct /health route mapping for convenience and root health probes
  await app.register(healthRoutes);

  return app;
}
