import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';

describe('Fastify App Foundation', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({
      logger: false,
      appConfig: loadConfig({
        CORS_ORIGIN: 'http://localhost:3000',
      }),
    });

    // Test route for Zod validation error
    app.post('/test/zod', async (request) => {
      const schema = z.object({
        name: z.string().min(3),
      });
      return schema.parse(request.body);
    });

    // Test route for unexpected error
    app.get('/test/boom', async () => {
      throw new Error('Database connection exploded with sensitive info: secret123');
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health and GET /api/health', () => {
    it('returns status ok, version, and uptime for /health', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toMatchObject({
        status: 'ok',
        version: '0.1.0',
      });
      expect(typeof body.uptime).toBe('number');
      expect(body.uptime).toBeGreaterThanOrEqual(0);
    });

    it('returns status ok, version, and uptime for /api/health', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toMatchObject({
        status: 'ok',
        version: '0.1.0',
      });
      expect(typeof body.uptime).toBe('number');
    });
  });

  describe('Centralized Error Handler', () => {
    it('formats Zod validation errors to 400 with VALIDATION_ERROR code', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/test/zod',
        payload: { name: 'ab' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'name: String must contain at least 3 character(s)',
        },
      });
      expect(response.body).not.toContain('stack');
    });

    it('formats unexpected errors to 500 without leaking stack traces or internal messages', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test/boom',
      });

      expect(response.statusCode).toBe(500);
      const body = response.json();
      expect(body).toEqual({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
        },
      });
      expect(response.body).not.toContain('Database connection exploded');
      expect(response.body).not.toContain('secret123');
      expect(response.body).not.toContain('stack');
    });

    it('formats 404 route errors to consistent JSON shape', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/non-existent-route',
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'Route GET:/non-existent-route not found',
        },
      });
      expect(response.body).not.toContain('stack');
    });
  });

  describe('CORS behavior', () => {
    it('sets access-control-allow-origin header for allowed origin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
        headers: {
          origin: 'http://localhost:3000',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('does not allow arbitrary unauthorized origins', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
        headers: {
          origin: 'http://malicious-site.com',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});

