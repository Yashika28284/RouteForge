import { FastifyReply, FastifyRequest } from 'fastify';
import { geocode } from '../services/geocoding.service';

export async function geocodeHandler(
  req: FastifyRequest<{ Querystring: { q?: string } }>,
  reply: FastifyReply
) {
  const query = req.query.q;
  if (!query || query.trim().length === 0) {
    return reply.status(400).send({ error: 'BAD_REQUEST', message: 'Query parameter "q" is required.' });
  }
  const results = await geocode(query);
  return reply.send(results);
}
