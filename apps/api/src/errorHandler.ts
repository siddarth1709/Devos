import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
  };
}

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  request.log.error(error);

  if (error instanceof ZodError || error.name === 'ZodError') {
    const zodError = error as ZodError;
    const message = zodError.issues
      .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
      .join('; ');

    reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: message || 'Validation failed',
      },
    });
    return;
  }

  const fastifyErr = error as FastifyError;
  const statusCode = typeof fastifyErr.statusCode === 'number' && fastifyErr.statusCode >= 400 && fastifyErr.statusCode < 600
    ? fastifyErr.statusCode
    : 500;

  if (statusCode >= 500) {
    reply.status(statusCode).send({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      },
    });
    return;
  }

  reply.status(statusCode).send({
    error: {
      code: fastifyErr.code || 'BAD_REQUEST',
      message: fastifyErr.message || 'An error occurred',
    },
  });
}
