from typing import List, Literal, Optional, Tuple

from pydantic import BaseModel, field_validator

Objective = Literal["TIME", "DISTANCE"]
TimeWindow = Optional[Tuple[int, int]]

# The backend caps routes at 10 stops (see route-optimization.service.ts),
# so the matrix is at most 11x11 (10 stops + depot) in normal operation.
# This is a generous upper bound as defense-in-depth against a buggy or
# compromised caller sending a pathologically large matrix that would tie
# up the solver — not the primary limit, which is enforced upstream.
MAX_MATRIX_SIZE = 50


class SolveRequest(BaseModel):
    durationsSec: List[List[float]]
    distancesMeters: List[List[float]]
    objective: Objective
    timeWindows: Optional[List[TimeWindow]] = None
    serviceTimesSec: Optional[List[float]] = None

    @field_validator("durationsSec")
    @classmethod
    def _durations_bounded_square(cls, v: List[List[float]]) -> List[List[float]]:
        n = len(v)
        if n < 1:
            raise ValueError("durationsSec must have at least 1 node (the depot)")
        if n > MAX_MATRIX_SIZE:
            raise ValueError(f"durationsSec exceeds the maximum supported size ({MAX_MATRIX_SIZE})")
        if any(len(row) != n for row in v):
            raise ValueError("durationsSec must be a square NxN matrix")
        return v

    @field_validator("distancesMeters")
    @classmethod
    def _matrices_same_size(cls, v: List[List[float]], info) -> List[List[float]]:
        durations = info.data.get("durationsSec")
        if durations is not None:
            n = len(durations)
            if len(v) != n or any(len(row) != n for row in v) or any(
                len(row) != n for row in durations
            ):
                raise ValueError("durationsSec and distancesMeters must both be square NxN matrices of the same size")
        return v


class SolveResponse(BaseModel):
    sequence: List[int]
    totalDistanceMeters: float
    totalDurationSec: float
    solverTimeMs: int
    feasible: bool
