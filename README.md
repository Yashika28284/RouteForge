# RouteForge

A delivery route optimization app for a single driver visiting up to 10
stops. RouteForge solves a small Traveling Salesperson Problem over **real
road-network data** (not straight-line distance) and shows the optimized
route next to a naive baseline with a measurable improvement — e.g. *"32%
faster than your original stop order."*

Built as a complete, correct, well-tested small system rather than a
feature-maximal one — see [Scope](#scope) below.

---

## Features

- Add up to 10 stops by address search, click-on-map, or a one-click demo
  route (Delhi/NCR landmarks)
- Optimize for **fastest** (time) or **shortest** (distance), with optional
  per-stop delivery time windows and service durations
- Real road-network distances/durations via [OSRM](http://project-osrm.org/),
  not haversine/Euclidean estimates
- Before/after comparison: optimized route vs. a nearest-neighbor baseline,
  with distance and time improvement percentages
- Drag a stop on the map to move it and re-optimize without a full reload
- JWT auth, routes/stops scoped per user, Redis-cached routing matrix and
  geocoding results

## Architecture

```
React + TS + Vite + Leaflet + TanStack Query
        |  HTTPS/JSON
        v
Node.js + Fastify + TypeScript backend
        |                    \
        v                     v
  Redis (cache)          PostgreSQL (users/routes/stops)
        |
        v
  OSRM (public demo server, via HTTP)  — real road distances/times
        |
        v
  Python FastAPI + OR-Tools service   — solves the TSP given a distance/time matrix
```

Two backend processes by design: OR-Tools' first-class API is Python, so a
small internal FastAPI service does the solving while the Node API handles
auth, CRUD, caching, and orchestration.

### Why OR-Tools, not brute force

10 stops means 10! = 3,628,800 possible orderings — brute-forceable, but the
design deliberately uses a real combinatorial solver instead: OR-Tools'
`RoutingModel` with a `PATH_CHEAPEST_ARC` first-solution strategy and
`GUIDED_LOCAL_SEARCH` metaheuristic (bounded to a few seconds), which scales
to far larger stop counts and can enforce constraints like time windows via
`AddDimension`/`CumulVar` — something a brute-force enumeration can't do
cleanly.

### Why OSRM

Straight-line (haversine) distance is a poor proxy for delivery time — it
ignores one-way streets, highways, and physical barriers like rivers.
RouteForge calls OSRM's `/table` endpoint for a real road-network
duration+distance matrix, using the public demo server by default (see
`OSRM_BASE_URL`).

### Caching strategy

`routing.service.ts` implements cache-aside caching of the OSRM matrix:
requests are hashed into an order-independent cache key
(`route:matrix:<sha256>`) so the same set of stops in a different order (or
requested by a different user) still hits the cache. Geocoding results are
cached the same way (`geocode:<sha256>`). The Redis client
(`redis.client.ts`) never throws — if Redis is unreachable, caching is
silently disabled rather than breaking requests.

## Tech stack

| Layer             | Stack                                                      |
|--------------------|-------------------------------------------------------------|
| Frontend           | React, TypeScript, Vite, Leaflet, TanStack Query, Zustand   |
| Backend            | Node.js, Fastify, TypeScript, zod, raw parameterized SQL    |
| Optimize service   | Python, FastAPI, OR-Tools, Pydantic                         |
| Data               | PostgreSQL, Redis                                            |
| Routing/geocoding  | OSRM (public demo server), Nominatim                         |
| Infra              | Docker Compose, GitHub Actions CI                            |

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

See `backend/src/db/schema.sql` for the full DDL.

## API

All `/api/routes*` and `/api/routes/:id/stops*` endpoints require
`Authorization: Bearer <jwt>` and are scoped server-side to the
authenticated user — requesting someone else's route returns `404`, not
`403` (existence isn't leaked).

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

### Example: optimize a route

```bash
curl -X POST http://localhost:4000/api/routes/<route-id>/optimize \
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

Errors share one shape:

```json
{ "error": "VALIDATION_ERROR", "message": "human readable message", "details": {} }
```

Codes: `AUTH_ERROR` (401/409), `VALIDATION_ERROR` (422), `BAD_REQUEST` (400,
zod failures include `details`), `UNAUTHORIZED` (401), `NOT_FOUND` (404),
`ROUTING_SERVICE_UNAVAILABLE` (503, OSRM down),
`OPTIMIZE_SERVICE_UNAVAILABLE` (503, solver down), `INTERNAL_SERVER_ERROR`
(500, no stack trace ever sent).

### `optimize-service` internal contract

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

`sequence` is node indices starting and ending at the depot (`0`). If time
windows make the problem infeasible, `feasible: false` is returned and the
Node backend maps that to a `422` asking the user to widen a delivery
window.

## Adding stops (how the address field actually behaves)

There are two independent ways to add a stop, and they don't mix — this trips
people up, so it's worth being explicit:

1. **Address search.** Type into the Address field and click **Search**.
   This calls Nominatim (OpenStreetMap's geocoder), which only finds
   addresses that exist in OSM's indexed data — landmarks, named roads,
   localities, station names, etc. (e.g. `Jalandhar Cantt Railway Station`,
   `Model Town, Jalandhar`). You then **click a result from the dropdown**
   to select it. Typing alone does not select anything — the coordinates
   used for "Add stop" are only set once you pick a result (or click the
   map; see below), which is why **Add stop stays disabled** if you type an
   address and never click Search, or search but never pick a result.
   Free-form/informal addresses (e.g. a house number and street name not in
   OSM) will often return zero results — in which case use option 2.

2. **Click the map.** Click any point on the map to drop a stop at that
   exact latitude/longitude. This is the more reliable option for precise
   delivery points, since it doesn't depend on the address existing in
   OSM's database. The Address field is left blank — RouteForge does not
   currently reverse-geocode a clicked point back into a readable address —
   so type a label for your own reference (e.g. the real street address, or
   a customer name) into **Notes** rather than the Address field: editing
   the Address field after a map click can clear the selected coordinates
   and re-disable "Add stop." Once coordinates are set (by search-and-pick
   or by map click), fill in Priority / Service time / Window / Notes as
   needed and click **Add stop**.

Rule of thumb: pick **one** method per stop and don't touch the Address
field afterward unless you're about to click Search again.

## Local setup

### Prerequisites

Node.js 20+, Python 3.11+, PostgreSQL, Redis (or use Docker Compose for the
infra pieces — see below).

### Backend

```bash
cd backend
npm install
cp ../.env.example .env    # edit POSTGRES_*/REDIS_URL to point at real instances
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

Brings up everything — Postgres, Redis, the optimize service, backend, and
frontend — in one command:

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Postgres/Redis/optimize-service are internal-only (not published to the
  host)
- Points at the public OSRM demo server by default; no OSRM container is
  needed for v1

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

This is a portfolio project, so scope was deliberately trimmed once and
kept intentionally small. **Out of scope for v1:** route replay animation,
CSV/JSON export, optimization history/compare-two-runs UI, a fuel-cost or
weighted "balanced" objective, Swagger/OpenAPI docs, priority-based
optional stops or a max-route-duration constraint, refresh tokens, and
self-hosted OSRM. Delivery time windows **are** in scope.

## Resume bullet points

- Built a full-stack route optimization app (React/TypeScript, Node/Fastify,
  Python/FastAPI) that solves a constrained TSP with OR-Tools over real
  road-network data from OSRM, cutting delivery route distance by
  20–35% versus a naive stop order in testing.
- Designed a cache-aside Redis layer with order-independent, hash-based
  cache keys for routing matrices and geocoding, and a fault-tolerant Redis
  client that degrades gracefully (never throws) on cache-server failure.
- Shipped with 30+ automated tests across three services (Vitest, pytest),
  Docker Compose for one-command local orchestration, and a GitHub Actions
  CI pipeline running typecheck/lint/test/build in parallel per service.