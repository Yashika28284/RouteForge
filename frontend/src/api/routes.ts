import { apiRequest } from './client';
import type {
  CreateRouteInput,
  OptimizationObjective,
  OptimizationResponse,
  Route,
  Stop,
  StopInput,
  UpdateRouteInput,
} from '../types';

export function listRoutes() {
  return apiRequest<Route[]>('/routes');
}

export function createRoute(input: CreateRouteInput) {
  return apiRequest<Route>('/routes', { method: 'POST', body: input });
}

export function getRoute(id: string) {
  return apiRequest<Route & { stops: Stop[] }>(`/routes/${id}`);
}

export function updateRoute(id: string, input: UpdateRouteInput) {
  return apiRequest<Route>(`/routes/${id}`, { method: 'PUT', body: input });
}

export function deleteRoute(id: string) {
  return apiRequest<void>(`/routes/${id}`, { method: 'DELETE' });
}

export function createStop(routeId: string, input: StopInput) {
  return apiRequest<Stop>(`/routes/${routeId}/stops`, { method: 'POST', body: input });
}

export function updateStop(routeId: string, stopId: string, input: Partial<StopInput>) {
  return apiRequest<Stop>(`/routes/${routeId}/stops/${stopId}`, { method: 'PUT', body: input });
}

export function deleteStop(routeId: string, stopId: string) {
  return apiRequest<void>(`/routes/${routeId}/stops/${stopId}`, { method: 'DELETE' });
}

export function optimizeRoute(routeId: string, objective?: OptimizationObjective) {
  return apiRequest<OptimizationResponse>(`/routes/${routeId}/optimize`, {
    method: 'POST',
    body: objective ? { objective } : {},
  });
}
