import { pool } from '../db/pool';

export interface StopRow {
  id: string;
  route_id: string;
  address: string;
  latitude: number;
  longitude: number;
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  time_window_start: string | null;
  time_window_end: string | null;
  service_duration_min: number;
  notes: string | null;
  customer_order_id: string | null;
  sequence: number | null;
  created_at: string;
}

export interface NewStopInput {
  address: string;
  latitude: number;
  longitude: number;
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
  timeWindowStart?: string | null;
  timeWindowEnd?: string | null;
  serviceDurationMin?: number;
  notes?: string | null;
  customerOrderId?: string | null;
}

export const stopRepository = {
  async findAllForRoute(routeId: string): Promise<StopRow[]> {
    const { rows } = await pool.query<StopRow>(
      'SELECT * FROM stops WHERE route_id = $1 ORDER BY sequence NULLS LAST, created_at ASC',
      [routeId]
    );
    return rows;
  },

  async findOne(routeId: string, stopId: string): Promise<StopRow | null> {
    const { rows } = await pool.query<StopRow>(
      'SELECT * FROM stops WHERE id = $1 AND route_id = $2',
      [stopId, routeId]
    );
    return rows[0] ?? null;
  },

  async create(routeId: string, input: NewStopInput): Promise<StopRow> {
    const { rows } = await pool.query<StopRow>(
      `INSERT INTO stops
        (route_id, address, latitude, longitude, priority, time_window_start, time_window_end,
         service_duration_min, notes, customer_order_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        routeId,
        input.address,
        input.latitude,
        input.longitude,
        input.priority ?? 'NORMAL',
        input.timeWindowStart ?? null,
        input.timeWindowEnd ?? null,
        input.serviceDurationMin ?? 5,
        input.notes ?? null,
        input.customerOrderId ?? null,
      ]
    );
    return rows[0];
  },

  async update(routeId: string, stopId: string, fields: Partial<NewStopInput>): Promise<StopRow | null> {
    const columnMap: Record<string, string> = {
      address: 'address',
      latitude: 'latitude',
      longitude: 'longitude',
      priority: 'priority',
      timeWindowStart: 'time_window_start',
      timeWindowEnd: 'time_window_end',
      serviceDurationMin: 'service_duration_min',
      notes: 'notes',
      customerOrderId: 'customer_order_id',
    };
    const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return this.findOne(routeId, stopId);

    const setClauses = entries.map(([key], idx) => `${columnMap[key]} = $${idx + 3}`).join(', ');
    const values = entries.map(([, v]) => v);

    const { rows } = await pool.query<StopRow>(
      `UPDATE stops SET ${setClauses} WHERE id = $1 AND route_id = $2 RETURNING *`,
      [stopId, routeId, ...values]
    );
    return rows[0] ?? null;
  },

  async delete(routeId: string, stopId: string): Promise<boolean> {
    const result = await pool.query('DELETE FROM stops WHERE id = $1 AND route_id = $2', [stopId, routeId]);
    return (result.rowCount ?? 0) > 0;
  },

  async saveSequence(routeId: string, orderedStopIds: string[]): Promise<void> {
    await pool.query('BEGIN');
    try {
      for (let i = 0; i < orderedStopIds.length; i++) {
        await pool.query('UPDATE stops SET sequence = $1 WHERE id = $2 AND route_id = $3', [
          i,
          orderedStopIds[i],
          routeId,
        ]);
      }
      await pool.query('COMMIT');
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }
  },
};
