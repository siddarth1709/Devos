import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { healthRoutes } from './health.js';
import { authRoutes } from './auth.js';
import { demoRoutes } from './demo.js';
import { repositoryRoutes } from './repositories.js';
import { analysisRoutes } from './analyses.js';

export const apiRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(demoRoutes);
  await app.register(repositoryRoutes);
  await app.register(analysisRoutes);
};
