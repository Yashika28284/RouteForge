# RouteForge — Handoff Document

> **Status update:** everything in section 5 (optimize-service, frontend,
> Docker Compose, CI, README) has since been built. Backend `npx tsc
> --noEmit`/`eslint`/`npx vitest run` (24/24) still pass; optimize-service
> `pytest` passes (9/9) and `ruff check` is clean; frontend `tsc -b`,
> `eslint`, and `vite build` all pass. See `README.md` at the project root
> for the current setup/run instructions — the rest of this document is
> preserved as historical spec/context.

Give this whole file to whatever AI tool/IDE you continue with. It contains
the full spec, what's done, what's left, and exact contracts so nothing has
to be re-explained or re-decided.

---

## 1. What this project is

**RouteForge** — a delivery route optimization app for one driver visiting
up to 10 stops. It solves a small Traveling Salesperson Problem using real
road-network data (not straight-line distance), and its headline feature is
showing the optimized route next to a naive baseline with a measurable
% improvement (e.g. "32% faster than your original order").

This is a **portfolio project for a software engineering internship/new-grad
resume** — the goal is a complete, correct, well-tested small system, not a
feature-maximal one. Scope has already been deliberately trimmed once (see
section 4, "explicitly cut for v1") — do not add those features back in
unless the user asks.

## 2. Architecture (as built)

```
React + TS + Leaflet  (NOT YET BUILT)
        |  HTTPS/JSON
        v
Node.js + Fastify + TypeScript backend   (BUILT, tested, typechecked)
        |                    \
        v                     v
  Redis (cache)          PostgreSQL (users/routes/stops)
        |
        v
  OSRM (public demo server, via HTTP)  — real road distances/times
        |
        v
  Python FastAPI + OR-Tools service   (NOT YET BUILT)
   — solves the TSP given a distance/time matrix
```

Two backend processes by design (not a mistake, not extra scope): OR-Tools'
first-class API is Python, so a small internal FastAPI service does the
solving, and the Node API does everything else (auth, CRUD, caching,
orchestration). Do not try to merge these or add more services.

## 3. What's already built and verified (do not redo)

Located under `backend/`. **All of this has been run and passes**:
`npx tsc --noEmit` is clean, and `npx vitest run` passes 24/24 tests across
6 test files.

- `src/config/env.ts` — zod-validated environment config
- `src/db/schema.sql` + `src/db/migrate.ts` — Postgres schema (users, routes,
  stops) and a runner (`npm run migrate`)
- `src/db/pool.ts` — pg Pool + health check
- `src/clients/redis.client.ts` — Redis wrapper that **never throws**; on
  connection failure it silently disables caching rather than breaking
  requests
- `src/clients/osrm.client.ts` — calls OSRM's `/table` endpoint for a real
  road-network duration+distance matrix (lng,lat order, as OSRM expects)
- `src/clients/nominatim.client.ts` — geocoding
- `src/clients/optimize.client.ts` — HTTP client for the **not-yet-built**
  Python OR-Tools service; defines the exact contract that service must
  satisfy (see section 5)
- `src/utils/cacheKey.ts` — deterministic, order-independent cache keys
  (`route:matrix:<sha256>`, `geocode:<sha256>`)
- `src/utils/jwt.ts`, `src/utils/logger.ts`
- `src/repositories/` — user, route, stop repositories (parameterized SQL,
  no ORM, all queries scoped by `user_id` where relevant)
- `src/services/`
  - `auth.service.ts` — bcrypt + JWT register/login
  - `routing.service.ts` — orchestrates OSRM + Redis cache (cache-aside
    pattern), including remapping a cached matrix back to a caller's
    requested coordinate order
  - `baseline.service.ts` — computes "original order" and "nearest
    neighbor" baseline routes over the same matrix, for the before/after
    comparison
  - `geocoding.service.ts` — cached geocoding
  - `route-optimization.service.ts` — the main orchestration: validates
    stops (count, duplicate coords, invalid coords, impossible time
    windows), builds the matrix, calls the (not-yet-built) optimize
    service, computes baselines and % improvement, persists results
- `src/controllers/`, `src/routes/index.ts` — REST API wiring, see section 6
- `src/middleware/auth.middleware.ts` — JWT bearer auth guard
- `src/middleware/error.middleware.ts` — centralized error handler, maps
  known error types to status codes, never leaks stack traces
- `src/validators/` — zod schemas per endpoint
- `tests/unit/` — cache key hashing, baseline math, improvement %, JWT
- `tests/api/` — auth flows, route CRUD + ownership enforcement, optimize
  endpoint edge cases (0 stops, no depot) — DB/Redis are mocked with
  `vi.mock` so these run fast with no live infra required
- `Dockerfile`, `package.json`, `tsconfig.json`, `vitest.config.ts`

Root: `.env.example` (all vars documented), `01-DESIGN.md` (original full
architecture write-up from before scope was trimmed — background context,
not all of it still applies post-trim).

## 4. What's explicitly OUT of scope for v1 (do not build unless asked)

- Route replay animation
- CSV/JSON export
- Optimization history + compare-two-runs UI (no `optimization_runs` table)
- Fuel-cost objective and "Balanced" weighted objective (only `TIME` and
  `DISTANCE` exist as objectives)
- Swagger/OpenAPI docs page
- Priority-based optional stops / disjunctions, max-route-duration
  constraint (priority field exists in the DB/API but the solver does not
  yet need to act on it beyond accepting it)
- Rate limiting beyond the basic `@fastify/rate-limit` already wired in,
  refresh tokens, request logging middleware beyond what exists
- Self-hosted OSRM (use the public demo server via `OSRM_BASE_URL` env var)

Time windows **are** in scope (validated + sent to the solver).

## 5. What's left to build

### 5a. Python OR-Tools service (`optimize-service/`)

Not started. Must expose exactly this contract, because the Node backend
(`backend/src/clients/optimize.client.ts`) already calls it:

**`POST /solve`** (internal service, FastAPI)

Request body:
```json
{
  "durationsSec": [[0, 10, ...], ...],
  "distancesMeters": [[0, 500, ...], ...],
  "objective": "TIME",
  "timeWindows": [null, [36000, 39600], null, ...],
  "serviceTimesSec": [0, 300, 600, ...]
}
```
- Matrices are NxN, symmetric or not, node `0` is always the depot.
- `timeWindows[i]` is either `null` (no constraint) or `[startSec, endSec]`
  measured as seconds from route start — index-aligned with the matrices.
- `serviceTimesSec[i]` is time spent at that stop before departing.
- `objective` is `"TIME"` or `"DISTANCE"` — use `durationsSec` or
  `distancesMeters` respectively as the arc cost matrix.

Response body:
```json
{
  "sequence": [0, 3, 1, 2, 0],
  "totalDistanceMeters": 32400,
  "totalDurationSec": 3480,
  "solverTimeMs": 31,
  "feasible": true
}
```
- `sequence` is node indices in visiting order, starting and ending at `0`
  (the depot).
- If time windows make the problem infeasible, return `"feasible": false`
  (Node already handles this and returns a 422 to the client with a
  message about widening a delivery window — see
  `route-optimization.service.ts`).

Implementation approach (already decided, follow it): OR-Tools
`RoutingIndexManager` + `RoutingModel`, `PATH_CHEAPEST_ARC` first-solution
strategy + `GUIDED_LOCAL_SEARCH` metaheuristic with a bounded time limit
(2–5s). Use `AddDimension` for cumulative time to encode time windows via
`CumulVar(index).SetRange(start, end)` per node when that node has a
window.

Also needed: `requirements.txt` (fastapi, uvicorn, ortools, pydantic),
`Dockerfile`, and pytest unit tests against hand-built small matrices with
known-correct answers (verifiable by hand or brute force in the test
itself — not just "it returns something").

### 5b. Frontend (`frontend/`)

Not started. React + TypeScript + Vite + Leaflet + TanStack Query.

Screens needed:
- Login / Register
- Dashboard: list of saved routes
- Route editor:
  - Leaflet map (OSM tiles), depot marker, draggable stop markers
  - Dragging a marker updates lat/lng via `PUT /api/routes/:id/stops/:stopId`
    and should trigger re-optimization without a full page reload
  - Address search box → `GET /api/geocode?q=...` → place marker → add stop
  - Click-on-map to add a stop directly
  - Stop list panel: add/edit/delete stops (address, priority, time window,
    service duration, notes, customer order id)
  - Objective toggle: Fastest (TIME) vs Shortest (DISTANCE)
  - "Optimize Route" button → `POST /api/routes/:id/optimize`
  - Results panel: optimized route order, distance/time, and the
    before/after comparison table (optimized vs baseline vs % improvement)
    — this is the standout feature, don't cut corners on it
  - Small performance readout: matrix time / solver time / total time
    (already returned by the API in `performance{}`)
- "Load Demo Route" button — hardcode ~8-10 real coordinates in one city
  (e.g. Delhi/NCR, since OSRM demo server covers global OSM data) so a
  reviewer can click Optimize immediately without typing addresses

State: TanStack Query for server state (routes, stops), a small store
(zustand or just context) for auth token + current route being edited. No
localStorage/sessionStorage issues here since this is a real app, not an
artifact — normal browser storage is fine for the JWT.

### 5c. Docker Compose

Not started. Needs: `frontend`, `backend`, `optimize-service`, `postgres`
(named volume + healthcheck), `redis` (healthcheck). Point `OSRM_BASE_URL`
at the public demo server by default (`https://router.project-osrm.org`) —
no OSRM container needed for v1. Backend depends_on postgres+redis+
optimize-service; frontend depends_on backend. Only frontend and backend
ports published to host; postgres/redis/optimize-service internal-only.

### 5d. GitHub Actions CI

Not started. `.github/workflows/ci.yml` should run, in parallel jobs:
- backend: install → `npm run typecheck` → `npm run lint` → `npm test` →
  `npm run build`
- optimize-service: install → ruff lint → pytest
- frontend: install → lint → typecheck → build

Use GitHub Actions `services:` for postgres+redis if/when real integration
tests (against live DB) are added — current backend tests are mocked and
don't need this, so CI can be simple for now.

### 5e. README.md

Not started. Should cover: problem, features, architecture (diagram),
tech stack, why OR-Tools (avoids 10! = 3,628,800 brute force via local
search, not exhaustive enumeration), why OSRM, Redis caching strategy, DB
schema, API docs with example requests/responses, local setup, Docker
setup, testing commands, and 3 resume bullet points at the end.

## 6. Full REST API (as implemented in `backend/`)

All `/api/routes*` and `/api/routes/:id/stops*` require
`Authorization: Bearer <jwt>` and are scoped server-side to the
authenticated user — a request for someone else's route returns 404, not
403 (don't leak existence).

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

`OptimizationResponse` shape (see
`route-optimization.service.ts::OptimizationResponse`):
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

Error shape (all errors, via centralized handler):
```json
{ "error": "VALIDATION_ERROR", "message": "human readable message", "details": { } }
```
Known `error` codes: `AUTH_ERROR` (401/409), `VALIDATION_ERROR` (422),
`BAD_REQUEST` (400, includes zod validation failures with `details`),
`UNAUTHORIZED` (401), `NOT_FOUND` (404),
`ROUTING_SERVICE_UNAVAILABLE` (503, OSRM down),
`OPTIMIZE_SERVICE_UNAVAILABLE` (503, Python service down),
`INTERNAL_SERVER_ERROR` (500, generic fallback — no stack trace ever sent).

## 7. Database schema (already migrated via `backend/src/db/schema.sql`)

`users(id, email, password_hash, created_at)`,
`routes(id, user_id, name, optimization_objective['TIME'|'DISTANCE'], status['DRAFT'|'OPTIMIZED'], depot_lat, depot_lng, depot_address, total_distance_km, total_duration_min, baseline_distance_km, baseline_duration_min, matrix_time_ms, solver_time_ms, execution_time_ms, last_optimized_at, created_at, updated_at)`,
`stops(id, route_id, address, latitude, longitude, priority['LOW'|'NORMAL'|'HIGH'], time_window_start, time_window_end, service_duration_min, notes, customer_order_id, sequence, created_at)`.

No `optimization_runs` table in v1 (history feature was cut).

## 8. How to run what exists today

```bash
cd backend
npm install
cp ../.env.example .env    # then edit POSTGRES_*/REDIS_URL to point at real instances
npm run migrate            # applies schema.sql
npm run dev                # starts Fastify on :4000
npm test                   # 24 tests, all mocked, no live infra needed
```

The optimize-service call and full end-to-end optimize flow will fail
until `optimize-service/` exists (correctly returns 503
`OPTIMIZE_SERVICE_UNAVAILABLE`, doesn't crash) — that's expected and by
design (graceful degradation, already tested).

## 9. Ground rules for whoever continues this

- Don't reintroduce anything from section 4's cut list unless the user
  explicitly asks.
- Match the existing conventions: repositories do raw parameterized SQL
  (no ORM), services own business logic, controllers are thin, zod for
  validation, centralized error handler maps custom error classes to HTTP
  codes.
- Keep tests real (assert actual computed values, not "it returns
  something") — see `tests/unit/baseline.test.ts` for the bar to hit.
- This is a resume/interview project — prioritize correctness and finish
  over feature count. A smaller complete system beats a bigger incomplete
  one.
