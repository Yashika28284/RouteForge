import { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import * as authController from '../controllers/auth.controller';
import * as routeController from '../controllers/route.controller';
import * as stopController from '../controllers/stop.controller';
import * as geocodeController from '../controllers/geocode.controller';
import * as healthController from '../controllers/health.controller';
import { requireAuth } from '../middleware/auth.middleware';

export async function registerRoutes(app: FastifyInstance) {
  app.get('/api/health', healthController.health);
  app.get('/api/health/ready', healthController.readiness);

  // Tighter limit on auth endpoints specifically — the global 100/min is
  // too loose to meaningfully slow down credential-stuffing / password
  // guessing against login.
  app.register(async (authApp) => {
    authApp.register(rateLimit, { max: 10, timeWindow: '1 minute' });
    authApp.post('/api/auth/register', authController.register);
    authApp.post('/api/auth/login', authController.login);
    authApp.post('/api/auth/logout', authController.logout);
  });

  app.get('/api/geocode', geocodeController.geocodeHandler);

  app.register(async (protectedApp) => {
    protectedApp.addHook('preHandler', requireAuth);

    protectedApp.get('/api/routes', routeController.listRoutes);
    protectedApp.post('/api/routes', routeController.createRoute);
    protectedApp.get('/api/routes/:id', routeController.getRoute);
    protectedApp.put('/api/routes/:id', routeController.updateRoute);
    protectedApp.delete('/api/routes/:id', routeController.deleteRoute);

    protectedApp.post('/api/routes/:id/stops', stopController.createStop);
    protectedApp.put('/api/routes/:id/stops/:stopId', stopController.updateStop);
    protectedApp.delete('/api/routes/:id/stops/:stopId', stopController.deleteStop);

    protectedApp.post('/api/routes/:id/optimize', routeController.optimize);
  });
}
