import { pool } from '../db/pool';

export interface RouteRow {
  id: string;
  user_id: string;
  name: string;
  optimization_objective: 'TIME' | 'DISTANCE';
  status: 'DRAFT' | 'OPTIMIZED';
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
}

export const routeRepository = {
  async findAllForUser(userId: string): Promise<RouteRow[]> {
    const { rows } = await pool.query<RouteRow>(
      'SELECT * FROM routes WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return rows;
  },

  async findByIdForUser(id: string, userId: string): Promise<RouteRow | null> {
    const { rows } = await pool.query<RouteRow>(
      'SELECT * FROM routes WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return rows[0] ?? null;
  },

  async create(
    userId: string,
    name: string,
    objective: 'TIME' | 'DISTANCE',
    depot?: { lat: number; lng: number; address?: string }
  ): Promise<RouteRow> {
    const { rows } = await pool.query<RouteRow>(
      `INSERT INTO routes (user_id, name, optimization_objective, depot_lat, depot_lng, depot_address)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, name, objective, depot?.lat ?? null, depot?.lng ?? null, depot?.address ?? null]
    );
    return rows[0];
  },

  async update(
    id: string,
    userId: string,
    fields: Partial<Pick<RouteRow, 'name' | 'optimization_objective' | 'depot_lat' | 'depot_lng' | 'depot_address'>>
  ): Promise<RouteRow | null> {
    const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return this.findByIdForUser(id, userId);

    const setClauses = entries.map(([key], idx) => `${key} = $${idx + 3}`).join(', ');
    const values = entries.map(([, v]) => v);

    const { rows } = await pool.query<RouteRow>(
      `UPDATE routes SET ${setClauses} WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId, ...values]
    );
    return rows[0] ?? null;
  },

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await pool.query('DELETE FROM routes WHERE id = $1 AND user_id = $2', [id, userId]);
    return (result.rowCount ?? 0) > 0;
  },

  async saveOptimizationResult(
    id: string,
    result: {
      totalDistanceKm: number;
      totalDurationMin: number;
      baselineDistanceKm: number;
      baselineDurationMin: number;
      matrixTimeMs: number;
      solverTimeMs: number;
      executionTimeMs: number;
    }
  ): Promise<RouteRow> {
    const { rows } = await pool.query<RouteRow>(
      `UPDATE routes SET
        status = 'OPTIMIZED',
        total_distance_km = $2,
        total_duration_min = $3,
        baseline_distance_km = $4,
        baseline_duration_min = $5,
        matrix_time_ms = $6,
        solver_time_ms = $7,
        execution_time_ms = $8,
        last_optimized_at = now()
       WHERE id = $1 RETURNING *`,
      [
        id,
        result.totalDistanceKm,
        result.totalDurationMin,
        result.baselineDistanceKm,
        result.baselineDurationMin,
        result.matrixTimeMs,
        result.solverTimeMs,
        result.executionTimeMs,
      ]
    );
    return rows[0];
  },
};
