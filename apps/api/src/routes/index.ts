import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { healthRoutes } from './health.js';
import { authRoutes } from './auth.js';
import { demoRoutes } from './demo.js';
import { repositoryRoutes } from './repositories.js';
import { analysisRoutes } from './analyses.js';
import { aiRoutes } from './ai.js';
import { githubRoutes } from './github.js';
import { findingRoutes } from './findings.js';
import { guardRoutes } from './guard.js';
import { actionRoutes } from './actions.js';

export const apiRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(demoRoutes);
  await app.register(repositoryRoutes);
  await app.register(analysisRoutes);
  await app.register(aiRoutes);
  await app.register(githubRoutes);
  await app.register(findingRoutes);
  await app.register(guardRoutes);
  await app.register(actionRoutes);
};
