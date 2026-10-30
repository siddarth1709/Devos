import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export interface HealthResponse {
  status: string;
  version: string;
  uptime: number;
}

export const healthRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/health', async (): Promise<HealthResponse> => {
    return {
      status: 'ok',
      version: '0.1.0',
      uptime: process.uptime(),
    };
  });
};

