"""RouteForge optimize-service — internal FastAPI wrapper around OR-Tools.

Exposes POST /solve per the contract defined in HANDOFF.md section 5a, which
backend/src/clients/optimize.client.ts already calls. This service is
internal-only (not exposed to the public internet in docker-compose).
"""
from fastapi import FastAPI

from app.schemas import SolveRequest, SolveResponse
from app.solver.tsp_solver import solve

# Internal-only service (private on Render, not published to the host in
# Docker Compose) — the interactive docs/schema endpoints have no audience
# and are disabled rather than left on by FastAPI's default.
app = FastAPI(
    title="routeforge-optimize-service",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/solve", response_model=SolveResponse)
def solve_route(request: SolveRequest) -> SolveResponse:
    return solve(
        durations_sec=request.durationsSec,
        distances_meters=request.distancesMeters,
        objective=request.objective,
        time_windows=request.timeWindows,
        service_times_sec=request.serviceTimesSec,
    )
