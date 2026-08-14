import { FastifyReply, FastifyRequest } from 'fastify';
import { routeRepository } from '../repositories/route.repository';
import { stopRepository } from '../repositories/stop.repository';
import { createStopSchema, updateStopSchema } from '../validators/route.validators';

async function assertRouteOwnership(routeId: string, userId: string) {
  const route = await routeRepository.findByIdForUser(routeId, userId);
  return route;
}

export async function createStop(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const route = await assertRouteOwnership(req.params.id, req.userId!);
  if (!route) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Route not found.' });

  const existingCount = (await stopRepository.findAllForRoute(route.id)).length;
  if (existingCount >= 10) {
    return reply.status(422).send({
      error: 'VALIDATION_ERROR',
      message: 'This MVP supports at most 10 stops per route.',
    });
  }

  const body = createStopSchema.parse(req.body);
  const stop = await stopRepository.create(route.id, body);
  return reply.status(201).send(stop);
}

export async function updateStop(
  req: FastifyRequest<{ Params: { id: string; stopId: string } }>,
  reply: FastifyReply
) {
  const route = await assertRouteOwnership(req.params.id, req.userId!);
  if (!route) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Route not found.' });

  const body = updateStopSchema.parse(req.body);
  const updated = await stopRepository.update(route.id, req.params.stopId, body);
  if (!updated) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Stop not found.' });
  return reply.send(updated);
}

export async function deleteStop(
  req: FastifyRequest<{ Params: { id: string; stopId: string } }>,
  reply: FastifyReply
) {
  const route = await assertRouteOwnership(req.params.id, req.userId!);
  if (!route) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Route not found.' });

  const deleted = await stopRepository.delete(route.id, req.params.stopId);
  if (!deleted) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Stop not found.' });
  return reply.status(204).send();
}
