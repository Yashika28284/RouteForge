import { FastifyReply, FastifyRequest } from 'fastify';
import { routeRepository } from '../repositories/route.repository';
import { stopRepository } from '../repositories/stop.repository';
import { createRouteSchema, updateRouteSchema, optimizeRouteSchema } from '../validators/route.validators';
import { optimizeRoute } from '../services/route-optimization.service';

function notFound(reply: FastifyReply) {
  return reply.status(404).send({ error: 'NOT_FOUND', message: 'Route not found.' });
}

export async function listRoutes(req: FastifyRequest, reply: FastifyReply) {
  const routes = await routeRepository.findAllForUser(req.userId!);
  return reply.send(routes);
}

export async function createRoute(req: FastifyRequest, reply: FastifyReply) {
  const body = createRouteSchema.parse(req.body);
  const route = await routeRepository.create(req.userId!, body.name, body.optimizationObjective, body.depot);
  return reply.status(201).send(route);
}

export async function getRoute(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const route = await routeRepository.findByIdForUser(req.params.id, req.userId!);
  if (!route) return notFound(reply);
  const stops = await stopRepository.findAllForRoute(route.id);
  return reply.send({ ...route, stops });
}

export async function updateRoute(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const body = updateRouteSchema.parse(req.body);
  const existing = await routeRepository.findByIdForUser(req.params.id, req.userId!);
  if (!existing) return notFound(reply);

  const updated = await routeRepository.update(req.params.id, req.userId!, {
    name: body.name,
    optimization_objective: body.optimizationObjective,
    depot_lat: body.depot?.lat,
    depot_lng: body.depot?.lng,
    depot_address: body.depot?.address,
  });
  return reply.send(updated);
}

export async function deleteRoute(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const deleted = await routeRepository.delete(req.params.id, req.userId!);
  if (!deleted) return notFound(reply);
  return reply.status(204).send();
}

export async function optimize(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const body = optimizeRouteSchema.parse(req.body ?? {});
  const route = await routeRepository.findByIdForUser(req.params.id, req.userId!);
  if (!route) return notFound(reply);

  if (body.objective && body.objective !== route.optimization_objective) {
    await routeRepository.update(route.id, req.userId!, { optimization_objective: body.objective });
    route.optimization_objective = body.objective;
  }

  const result = await optimizeRoute(route);
  return reply.send(result);
}
