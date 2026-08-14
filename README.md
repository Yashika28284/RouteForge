# RouteForge

RouteForge helps a single driver figure out the smartest order to visit up
to 10 delivery stops. Instead of guessing, it solves a real optimization
problem — a constrained Traveling Salesperson Problem — over actual
road-network data, then shows you exactly how much better the optimized
route is than your original stop order (e.g. *"32% faster than your
starting plan"*).

It's built as a small, complete, well-tested system rather than a
feature-stuffed one. See [Scope](#scope) for what was deliberately left out
and why.

🔗 **Live demo:** [route-forge-lime.vercel.app](https://route-forge-lime.vercel.app)
*(hosted on free-tier infrastructure — the backend may take 30–60s to wake
up if it's been idle)*

---

## What it does

- Add up to 10 stops by searching an address, clicking the map, or loading
  a one-click demo route
- Optimize for **fastest** (time) or **shortest** (distance), with optional
  per-stop delivery time windows and service durations
- Uses real road-network distances and durations via
  [OSRM](http://project-osrm.org/) — not a straight-line estimate
- Shows a before/after comparison: your optimized route vs. a
  nearest-neighbor baseline, with the actual improvement in both distance
  and time
- Drag a stop on the map to move it and re-optimize without reloading
- Full auth, with routes and stops scoped per user, and a Redis cache in
  front of the routing matrix and geocoding calls

## How it's put together

```
React + TS + Vite + Leaflet + TanStack Query
        |  HTTPS / JSON
        v
Node.js + Fastify + TypeScript backend
        |                    \
        v                     v
  Redis (cache)          PostgreSQL (users / routes / stops)
        |
        v
  OSRM (public demo server)  — real road distances & times
        |
        v
  Python FastAPI + OR-Tools service  — solves the TSP given the matrix
```

There are two backend processes on purpose. OR-Tools' best support is in
Python, so a small internal FastAPI service handles the actual solving,
while the Node API takes care of auth, CRUD, caching, and orchestrating the
whole request.

### Why OR-Tools instead of brute force

Ten stops means 3,628,800 possible orderings (10!) — technically
brute-forceable, but that approach doesn't scale and can't express real
constraints. Instead, RouteForge uses OR-Tools' `RoutingModel` with a
`PATH_CHEAPEST_ARC` first-solution strategy and a `GUIDED_LOCAL_SEARCH`
metaheuristic (time-boxed to a few seconds). This scales comfortably beyond
10 stops and can enforce constraints like delivery time windows through
`AddDimension` / `CumulVar` — something a brute-force search can't do
cleanly.

### Why OSRM instead of straight-line distance

Haversine distance is a poor stand-in for real delivery time — it ignores
one-way streets, highways, rivers, and everything else that actually
shapes a route. RouteForge calls OSRM's `/table` endpoint to get a genuine
road-network duration and distance matrix, using the public OSRM demo
server by default (`OSRM_BASE_URL`).

### Caching strategy

`routing.service.ts` caches the OSRM matrix cache-aside style: each request
is hashed into an order-independent key (`route:matrix:<sha256>`), so the
same set of stops — regardless of order, or which user requested them —
hits the same cache entry. Geocoding results are cached the same way
(`geocode:<sha256>`). The Redis client (`redis.client.ts`) is written to
never throw: if Redis is unreachable, caching just quietly turns off
instead of breaking requests.

## Tech stack

| Layer             | Stack                                                      |
|--------------------|-------------------------------------------------------------|
| Frontend           | React, TypeScript, Vite, Leaflet, TanStack Query, Zustand   |
| Backend            | Node.js, Fastify, TypeScript, zod, raw parameterized SQL    |
| Optimize service   | Python, FastAPI, OR-Tools, Pydantic                         |
| Data               | PostgreSQL, Redis                                            |
| Routing/geocoding  | OSRM (public demo server), Nominatim                         |
| Infra              | Docker Compose (local), GitHub Actions CI                    |
| Hosting            | Render (backend + optimizer), Vercel (frontend), Neon (Postgres), Upstash (Redis) |

## Database schema

```
users(id, email, password_hash, created_at)

routes(id, user_id, name,
       optimization_objective['TIME'|'DISTANCE'], status['DRAFT'|'OPTIMIZED'],
       depot_lat, depot_lng, depot_address,
       total_distance_km, total_duration_min,
       baseline_distance_km, baseline_duration_min,
       matrix_time_ms, solver_time_ms, execution_time_ms,
       last_optimized_at, created_at, updated_at)

stops(id, route_id, address, latitude, longitude,
      priority['LOW'|'NORMAL'|'HIGH'],
      time_window_start, time_window_end, service_duration_min,
      notes, customer_order_id, sequence, created_at)
```

Full DDL lives in `backend/src/db/schema.sql`.

## API

Every `/api/routes*` and `/api/routes/:id/stops*` endpoint requires
`Authorization: Bearer <jwt>` and is scoped server-side to the
authenticated user. Requesting someone else's route returns `404`, not
`403` — so a route's existence is never leaked to a user who doesn't own
it.

```
POST   /api/auth/register       { email, password } -> { user, accessToken }
POST   /api/auth/login          { email, password } -> { user, accessToken }
POST   /api/auth/logout

GET    /api/routes                          -> Route[]
POST   /api/routes                          { name, optimizationObjective, depot? } -> Route
GET    /api/routes/:id                      -> Route & { stops: Stop[] }
PUT    /api/routes/:id                      { name?, optimizationObjective?, depot? } -> Route
DELETE /api/routes/:id                      -> 204

POST   /api/routes/:id/stops                { address, latitude, longitude, priority?, timeWindowStart?, timeWindowEnd?, serviceDurationMin?, notes?, customerOrderId? } -> Stop
PUT    /api/routes/:id/stops/:stopId        (partial of the above) -> Stop
DELETE /api/routes/:id/stops/:stopId        -> 204

POST   /api/routes/:id/optimize             { objective? } -> OptimizationResponse

GET    /api/geocode?q=...                   -> { lat, lng, displayName }[]   (no auth required)

GET    /api/health                          -> { status: 'ok' }
GET    /api/health/ready                    -> { postgres: bool, redis: bool }
```

### Example: optimizing a route

```bash
curl -X POST https://routeforge-backend.onrender.com/api/routes/<route-id>/optimize \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{ "objective": "TIME" }'
```

```json
{
  "route": [
    { "stopId": "...", "address": "...", "latitude": 30.34, "longitude": 76.38,
      "sequence": 0, "legDistanceKm": 4.2, "legDurationMin": 8.1 }
  ],
  "totalDistanceKm": 32.4,
  "totalDurationMinutes": 58,
  "executionTimeMs": 215,
  "performance": { "matrixTimeMs": 184, "solverTimeMs": 31, "totalTimeMs": 215, "cacheHit": false },
  "baseline": { "strategy": "NEAREST_NEIGHBOR", "distanceKm": 47.8, "durationMinutes": 91 },
  "improvement": { "distancePercent": 32, "timePercent": 36 }
}
```

Errors all share one shape:

```json
{ "error": "VALIDATION_ERROR", "message": "human readable message", "details": {} }
```

| Code | Meaning |
|---|---|
| `AUTH_ERROR` | 401/409 — bad credentials or duplicate account |
| `VALIDATION_ERROR` | 422 |
| `BAD_REQUEST` | 400 — zod validation failures, `details` included |
| `UNAUTHORIZED` | 401 |
| `NOT_FOUND` | 404 |
| `ROUTING_SERVICE_UNAVAILABLE` | 503 — OSRM is down |
| `OPTIMIZE_SERVICE_UNAVAILABLE` | 503 — solver is down |
| `INTERNAL_SERVER_ERROR` | 500 — no stack trace is ever sent to the client |

### Internal contract: `optimize-service`

The Node backend calls `POST /solve` on the internal Python service:

```json
// Request
{
  "durationsSec": [[0, 10, ...], ...],
  "distancesMeters": [[0, 500, ...], ...],
  "objective": "TIME",
  "timeWindows": [null, [36000, 39600], null, ...],
  "serviceTimesSec": [0, 300, 600, ...]
}
```

```json
// Response
{
  "sequence": [0, 3, 1, 2, 0],
  "totalDistanceMeters": 32400,
  "totalDurationSec": 3480,
  "solverTimeMs": 31,
  "feasible": true
}
```

`sequence` lists node indices, starting and ending at the depot (`0`). If
the time windows make the problem infeasible, the solver returns
`feasible: false`, and the Node backend turns that into a `422` asking the
user to widen a delivery window.

## Running it locally

### Prerequisites

Node.js 20+, Python 3.11+, PostgreSQL, and Redis — or just use Docker
Compose for the infra pieces (see below).

### Backend

```bash
cd backend
npm install
cp ../.env.example .env    # point POSTGRES_*/REDIS_URL at real instances
npm run migrate            # applies schema.sql
npm run dev                # starts Fastify on :4000
```

### Optimize service

```bash
cd optimize-service
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                # starts Vite on :5173
```

## Docker Compose

Brings up everything at once — Postgres, Redis, the optimizer, the backend,
and the frontend:

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Postgres, Redis, and the optimize service stay internal-only, not
  published to the host
- Points at the public OSRM demo server by default, so no OSRM container
  is required for local dev

## Deploying it yourself (free tier)

The live demo runs entirely on free infrastructure:

| Piece | Where | Notes |
|---|---|---|
| Frontend | [Vercel](https://vercel.com) | Root directory `frontend`, `VITE_API_BASE_URL` env var pointed at the backend |
| Backend + optimizer | [Render](https://render.com) | Two free web services, deployed together via `render.yaml` (Blueprint) |
| Postgres | [Neon](https://neon.tech) | Free tier, pooled connection string as `DATABASE_URL` |
| Redis | [Upstash](https://upstash.com) | Free tier, TLS (`rediss://`) connection string as `REDIS_URL` |

A few things worth knowing about this setup:

- Render's free web services spin down after ~15 minutes idle and take
  30–60 seconds to wake back up on the next request. Neon and Upstash's
  free tiers don't sleep.
- Render's free tier doesn't support private services or pre-deploy
  commands, so both backend services are deployed as public web services,
  and the database migration runs automatically at container startup
  instead (see the `CMD` in `backend/Dockerfile`) — `schema.sql` is
  idempotent, so re-running it on every boot is a safe no-op once the
  schema already exists.
- `CORS_ORIGIN` on the backend must exactly match the frontend's origin —
  no trailing slash, correct protocol. `CORS_ORIGIN_REGEX` is available
  for matching Vercel preview-deploy URLs if you need it.

## Testing

```bash
# Backend — 24 tests, DB/Redis mocked, no live infra needed
cd backend && npm test

# Optimize service — solver tests against hand-built matrices with
# known-correct (brute-force-verified) answers, plus API contract tests
cd optimize-service && pytest

# Frontend — typecheck, lint, build
cd frontend && npm run typecheck && npm run lint && npm run build
```

## Scope

This is a portfolio project, so its scope was trimmed on purpose and kept
intentionally small.

**Out of scope for v1:** route replay animation, CSV/JSON export,
optimization history or compare-two-runs UI, a fuel-cost or weighted
"balanced" objective, Swagger/OpenAPI docs, priority-based optional stops
or a max-route-duration constraint, refresh tokens, and self-hosted OSRM.

Delivery time windows **are** in scope, and already implemented.

## Resume bullet points

- Built a full-stack route optimization app (React/TypeScript, Node/Fastify,
  Python/FastAPI) that solves a constrained TSP with OR-Tools over real
  road-network data from OSRM, cutting delivery route distance.
- Designed a cache-aside Redis layer with order-independent, hash-based
  cache keys for routing matrices and geocoding, backed by a fault-tolerant
  Redis client that degrades gracefully (never throws) on cache-server
  failure.
- Shipped with 30+ automated tests across three services (Vitest, pytest),
  Docker Compose for one-command local orchestration, and a GitHub Actions
  CI pipeline running typecheck/lint/test/build in parallel per service.
- Deployed the full stack — two backend services, Postgres, and Redis — on
  free-tier infrastructure (Render, Neon, Upstash, Vercel) with automatic
  schema migration on boot.