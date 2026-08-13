// NOTE on casing: request bodies use camelCase (per backend zod validators),
// but Route/Stop API *responses* are raw Postgres rows and therefore
// snake_case. OptimizationResponse is hand-built by the backend service and
// is camelCase. This mirrors backend/src/controllers + repositories exactly.

export interface User {
  id: string;
  email: string;
}

export type OptimizationObjective = 'TIME' | 'DISTANCE';
export type RouteStatus = 'DRAFT' | 'OPTIMIZED';
export type StopPriority = 'LOW' | 'NORMAL' | 'HIGH';

export interface Route {
  id: string;
  user_id: string;
  name: string;
  optimization_objective: OptimizationObjective;
  status: RouteStatus;
  depot_lat: number | null;
  depot_lng: number | null;
  depot_address: string | null;
  total_distance_km: number | null;
  total_duration_min: number | null;
  baseline_distance_km: number | null;
  baseline_duration_min: number | null;
  matrix_time_ms: number | null;
  solver_time_ms: number | null;
  execution_time_ms: number | null;
  last_optimized_at: string | null;
  created_at: string;
  updated_at: string;
  stops?: Stop[];
}

export interface Stop {
  id: string;
  route_id: string;
  address: string;
  latitude: number;
  longitude: number;
  priority: StopPriority;
  time_window_start: string | null; // "HH:MM" or "HH:MM:SS"
  time_window_end: string | null;
  service_duration_min: number;
  notes: string | null;
  customer_order_id: string | null;
  sequence: number | null;
  created_at: string;
}

export interface CreateRouteInput {
  name: string;
  optimizationObjective?: OptimizationObjective;
  depot?: { lat: number; lng: number; address?: string };
}

export interface UpdateRouteInput {
  name?: string;
  optimizationObjective?: OptimizationObjective;
  depot?: { lat: number; lng: number; address?: string };
}

export interface StopInput {
  address: string;
  latitude: number;
  longitude: number;
  priority?: StopPriority;
  timeWindowStart?: string | null; // "HH:MM"
  timeWindowEnd?: string | null;
  serviceDurationMin?: number;
  notes?: string | null;
  customerOrderId?: string | null;
}

export interface OptimizedStop {
  stopId: string;
  address: string;
  latitude: number;
  longitude: number;
  sequence: number;
  legDistanceKm: number;
  legDurationMin: number;
}

export interface OptimizationResponse {
  route: OptimizedStop[];
  totalDistanceKm: number;
  totalDurationMinutes: number;
  executionTimeMs: number;
  performance: {
    matrixTimeMs: number;
    solverTimeMs: number;
    totalTimeMs: number;
    cacheHit: boolean;
  };
  baseline: {
    strategy: 'ORIGINAL_ORDER' | 'NEAREST_NEIGHBOR';
    distanceKm: number;
    durationMinutes: number;
  };
  improvement: {
    distancePercent: number;
    timePercent: number;
  };
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

export interface ApiErrorBody {
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: ApiErrorBody
  ) {
    super(body.message);
  }
}
