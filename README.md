# RouteForge

A route optimizer for a single delivery driver juggling up to 10 stops. Feed it a list of addresses and it figures out the smartest order to hit them in, based on actual road data instead of straight-line guesses, then tells you exactly how much time or distance you saved compared to just going in the order you typed them ("32% faster than your original stop order," that sort of thing).

I kept this deliberately small and finished rather than half-building a dozen features. If you're curious what got left out and why, check the Scope section near the bottom.

## What it does

- Add up to 10 stops by searching an address, clicking directly on the map, or loading a one-click demo route around Delhi/NCR landmarks
- Optimize by time or by distance, with optional delivery windows and per-stop service durations
- Pulls real road-network distances and durations from OSRM, so it's not just measuring as the crow flies
- Puts the optimized route side-by-side with a nearest-neighbor baseline so the improvement is obvious, not just claimed
- Drag a stop to a new spot on the map and it re-optimizes on the fly, no page reload
- JWT auth with routes and stops scoped per user, plus a Redis-backed cache for the routing matrix and geocoding

## How it's put together

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

Running two backend processes probably looks like overkill at first glance, but OR-Tools is really a Python library at heart, so there's a small internal FastAPI service that does nothing but solve the routing problem. The Node API handles everything else: auth, CRUD, caching, and orchestrating calls to the other two services.

## Why OR-Tools instead of just brute-forcing it

At 10 stops you're looking at 10! = 3,628,800 possible orderings, so brute force would technically get there. I used a proper solver anyway — OR-Tools' RoutingModel, starting with PATH_CHEAPEST_ARC for a first pass and then GUIDED_LOCAL_SEARCH to refine it, capped at a few seconds of runtime. Part of the reasoning is future headroom: this scales well past 10 stops if I ever raise the limit. But the real reason is constraints — time windows need `AddDimension`/`CumulVar`, and there's no clean way to bolt that onto a brute-force enumeration.

## Why OSRM

Haversine distance looks fine on a whiteboard and falls apart the moment you introduce a one-way street, a highway, or a river cutting through the middle of your route. RouteForge calls OSRM's `/table` endpoint to get a real duration + distance matrix based on the actual road network. By default it points at the public demo server (`OSRM_BASE_URL`).

## Caching

`routing.service.ts` handles cache-aside caching on the OSRM matrix. The cache key is a hash of the stop set (`route:matrix:<sha256>`), and it's order-independent — the same stops, requested in a different order or by a different user, still hit the same cache entry. Geocoding works the same way (`geocode:<sha256>`). The Redis client (`redis.client.ts`) is written so it never throws: if Redis goes down, caching just quietly disables itself instead of taking the whole app with it.

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | React, TypeScript, Vite, Leaflet, TanStack Query, Zustand |
| Backend | Node.js, Fastify, TypeScript, zod, raw parameterized SQL |
| Optimize service | Python, FastAPI, OR-Tools, Pydantic |
| Data | PostgreSQL, Redis |
| Routing/geocoding | OSRM (public demo server), Nominatim |
| Infra | Docker Compose, GitHub Actions CI |

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

Everything under `/api/routes*` and `/api/routes/:id/stops*` requires `Authorization: Bearer <jwt>` and is scoped to whoever owns the token. Request someone else's route and you'll get a 404, not a 403 — no hinting that it even exists.

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

```
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

Errors all come back in the same shape:

```json
{ "error": "VALIDATION_ERROR", "message": "human readable message", "details": {} }
```

Codes you might see: `AUTH_ERROR` (401/409), `VALIDATION_ERROR` (422), `BAD_REQUEST` (400, zod failures include `details`), `UNAUTHORIZED` (401), `NOT_FOUND` (404), `ROUTING_SERVICE_UNAVAILABLE` (503, OSRM's down), `OPTIMIZE_SERVICE_UNAVAILABLE` (503, the solver's down), `INTERNAL_SERVER_ERROR` (500 — and no, you don't get a stack trace).

## The optimize-service contract

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
// Response
{
  "sequence": [0, 3, 1, 2, 0],
  "totalDistanceMeters": 32400,
  "totalDurationSec": 3480,
  "solverTimeMs": 31,
  "feasible": true
}
```

`sequence` is a list of node indices that starts and ends at the depot (0). If the time windows make the problem infeasible, you get `feasible: false` back, and the Node backend converts that into a 422 nudging the user to loosen up a delivery window.

## Adding stops — how the address field actually works

There are two ways to add a stop, and they genuinely don't mix, which trips people up, so here's the full rundown:

**Address search.** Type into the Address field and hit Search. This queries Nominatim (OpenStreetMap's geocoder), which can only find things that actually exist in OSM's data — landmarks, named roads, localities, station names, and so on (think *Jalandhar Cantt Railway Station* or *Model Town, Jalandhar*). You then have to click a result from the dropdown; typing alone doesn't select anything. Coordinates only get set once you pick a result (or click the map), which is why "Add stop" stays greyed out if you type something and never hit Search, or search and never pick a result. Informal addresses — a house number and street name OSM doesn't know about — will often come back with nothing. That's what the second method is for.

**Clicking the map.** Click anywhere and it drops a stop at that exact lat/lng. This is honestly the more reliable option for precise delivery points, since it doesn't care whether the address shows up in OSM at all. The catch: the Address field stays blank, because RouteForge doesn't reverse-geocode a map click into a readable address. So if you want a label for your own reference — the real street address, a customer name, whatever — put it in Notes, not Address. Editing the Address field after a map click can actually clear the coordinates you just set and grey out "Add stop" again.

Rule of thumb: pick one method per stop, and once you've got coordinates locked in, leave the Address field alone unless you're about to hit Search again.

## Running it locally

**You'll need:** Node.js 20+, Python 3.11+, PostgreSQL, Redis — or just use Docker Compose to handle the infra pieces (see below).

### Backend

```
cd backend
npm install
cp ../.env.example .env    # edit POSTGRES_*/REDIS_URL to point at real instances
npm run migrate            # applies schema.sql
npm run dev                # starts Fastify on :4000
```

### Optimize service

```
cd optimize-service
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```
cd frontend
npm install
npm run dev                # starts Vite on :5173
```

### Docker Compose

One command brings up everything — Postgres, Redis, the optimize service, backend, and frontend:

```
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Postgres, Redis, and the optimize service stay internal, not exposed to the host
- Uses the public OSRM demo server by default, so there's no OSRM container to worry about for v1

## Testing

```
# Backend — 24 tests, DB/Redis mocked, no live infra needed
cd backend && npm test

# Optimize service — solver tests run against hand-built matrices with
# known-correct (brute-force-verified) answers, plus API contract tests
cd optimize-service && pytest

# Frontend — typecheck, lint, build
cd frontend && npm run typecheck && npm run lint && npm run build
```

## Scope

This is a portfolio project, so I cut scope once, early, and stuck to the decision. Not in v1: route replay animation, CSV/JSON export, an optimization history or compare-two-runs view, a fuel-cost or "balanced" weighted objective, Swagger/OpenAPI docs, priority-based optional stops or a max-route-duration constraint, refresh tokens, and self-hosted OSRM. Delivery time windows did make the cut, though.

## Resume bullet points

- Built a full-stack route optimization app (React/TypeScript, Node/Fastify, Python/FastAPI) that solves a constrained TSP with OR-Tools over real road-network data from OSRM, cutting delivery route distance by 20–35% versus a naive stop order in testing.
- Designed a cache-aside Redis layer with order-independent, hash-based cache keys for routing matrices and geocoding, plus a fault-tolerant Redis client that degrades gracefully (never throws) on cache-server failure.
- Shipped with 30+ automated tests across three services (Vitest, pytest), Docker Compose for one-command local orchestration, and a GitHub Actions CI pipeline running typecheck/lint/test/build in parallel per service.