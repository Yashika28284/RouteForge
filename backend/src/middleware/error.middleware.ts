import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { AuthError } from '../services/auth.service';
import { OptimizationValidationError } from '../services/route-optimization.service';
import { RoutingServiceError } from '../clients/osrm.client';
import { OptimizeServiceError } from '../clients/optimize.client';

/**
 * Centralized error handler. Never leaks stack traces to the client;
 * maps known error types to sensible HTTP status codes and machine-readable
 * error codes, logs everything with request context.
 */
export function errorHandler(error: FastifyError | Error, req: FastifyRequest, reply: FastifyReply) {
  logger.error('Request failed', {
    requestId: req.id,
    method: req.method,
    url: req.url,
    error: error.message,
  });

  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: 'BAD_REQUEST',
      message: 'Request validation failed.',
      details: error.flatten().fieldErrors,
    });
  }
  if (error instanceof AuthError) {
    return reply.status(error.status).send({ error: 'AUTH_ERROR', message: error.message });
  }
  if (error instanceof OptimizationValidationError) {
    return reply.status(error.status).send({ error: 'VALIDATION_ERROR', message: error.message });
  }
  if (error instanceof RoutingServiceError) {
    return reply.status(503).send({ error: error.code, message: error.message });
  }
  if (error instanceof OptimizeServiceError) {
    return reply.status(503).send({ error: error.code, message: error.message });
  }
  if ('validation' in error && (error as FastifyError).validation) {
    return reply.status(400).send({ error: 'BAD_REQUEST', message: error.message });
  }

  return reply.status(500).send({ error: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong.' });
}
