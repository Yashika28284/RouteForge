import { FastifyReply, FastifyRequest } from 'fastify';
import { authService } from '../services/auth.service';
import { loginSchema, registerSchema } from '../validators/auth.validators';

export async function register(req: FastifyRequest, reply: FastifyReply) {
  const body = registerSchema.parse(req.body);
  const result = await authService.register(body.email, body.password);
  return reply.status(201).send(result);
}

export async function login(req: FastifyRequest, reply: FastifyReply) {
  const body = loginSchema.parse(req.body);
  const result = await authService.login(body.email, body.password);
  return reply.status(200).send(result);
}

export async function logout(_req: FastifyRequest, reply: FastifyReply) {
  // JWTs are stateless in this MVP; logout is handled client-side by discarding the token.
  return reply.status(200).send({ message: 'Logged out.' });
}
