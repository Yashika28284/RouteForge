-- RouteForge trimmed-MVP schema

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  CREATE TYPE optimization_objective AS ENUM ('TIME', 'DISTANCE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE route_status AS ENUM ('DRAFT', 'OPTIMIZED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  optimization_objective optimization_objective NOT NULL DEFAULT 'TIME',
  status route_status NOT NULL DEFAULT 'DRAFT',
  depot_lat DOUBLE PRECISION,
  depot_lng DOUBLE PRECISION,
  depot_address TEXT,
  total_distance_km NUMERIC(10, 2),
  total_duration_min NUMERIC(10, 2),
  baseline_distance_km NUMERIC(10, 2),
  baseline_duration_min NUMERIC(10, 2),
  matrix_time_ms INT,
  solver_time_ms INT,
  execution_time_ms INT,
  last_optimized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_routes_user_id ON routes(user_id);

DO $$ BEGIN
  CREATE TYPE stop_priority AS ENUM ('LOW', 'NORMAL', 'HIGH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  priority stop_priority NOT NULL DEFAULT 'NORMAL',
  time_window_start TIME,
  time_window_end TIME,
  service_duration_min INT NOT NULL DEFAULT 5,
  notes TEXT,
  customer_order_id TEXT,
  sequence INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stops_route_id ON stops(route_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_routes_updated_at ON routes;
CREATE TRIGGER trg_routes_updated_at
BEFORE UPDATE ON routes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
