import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { aiService } from '../ai/index.js';
import { getAnalysisById } from '../repo/index.js';

const AnalysisIdParamsSchema = z.object({
  id: z.string().min(1),
});

const AskQuestionBodySchema = z.object({
  question: z.string().min(1),
});

export const aiRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/ai/status', async (_request, reply) => {
    const status = await aiService.getStatus();
    return reply.status(200).send(status);
  });

  app.get('/analyses/:id/ai/status', async (request, reply) => {
    const params = AnalysisIdParamsSchema.parse(request.params);
    const analysis = await getAnalysisById(params.id);

    if (!analysis) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Analysis with ID "${params.id}" not found`,
        },
      });
    }

    const status = await aiService.getStatus();
    return reply.status(200).send({
      analysisId: params.id,
      ...status,
    });
  });

  app.post('/analyses/:id/ai/review', async (request, reply) => {
    const params = AnalysisIdParamsSchema.parse(request.params);
    const analysis = await getAnalysisById(params.id);

    if (!analysis) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Analysis with ID "${params.id}" not found`,
        },
      });
    }

    const result = await aiService.reviewChanges(params.id);
    return reply.status(200).send(result);
  });

  app.post('/analyses/:id/ai/risk-explanation', async (request, reply) => {
    const params = AnalysisIdParamsSchema.parse(request.params);
    const analysis = await getAnalysisById(params.id);

    if (!analysis) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Analysis with ID "${params.id}" not found`,
        },
      });
    }

    const result = await aiService.explainRisk(params.id);
    return reply.status(200).send(result);
  });

  app.post('/analyses/:id/ai/commit-message', async (request, reply) => {
    const params = AnalysisIdParamsSchema.parse(request.params);
    const analysis = await getAnalysisById(params.id);

    if (!analysis) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Analysis with ID "${params.id}" not found`,
        },
      });
    }

    const result = await aiService.suggestCommits(params.id);
    return reply.status(200).send(result);
  });

  app.post('/analyses/:id/ai/release-notes', async (request, reply) => {
    const params = AnalysisIdParamsSchema.parse(request.params);
    const analysis = await getAnalysisById(params.id);

    if (!analysis) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Analysis with ID "${params.id}" not found`,
        },
      });
    }

    const result = await aiService.generateReleaseNotes(params.id);
    return reply.status(200).send(result);
  });

  app.post('/analyses/:id/ai/ask', async (request, reply) => {
    const params = AnalysisIdParamsSchema.parse(request.params);
    const body = AskQuestionBodySchema.parse(request.body);

    const analysis = await getAnalysisById(params.id);
    if (!analysis) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Analysis with ID "${params.id}" not found`,
        },
      });
    }

    const result = await aiService.askQuestion(params.id, body.question);
    return reply.status(200).send(result);
  });
};

