import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { healthRoutes } from './health.js';
import { authRoutes } from './auth.js';
import { demoRoutes } from './demo.js';

export const apiRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(demoRoutes);
};

