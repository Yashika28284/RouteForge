from typing import List, Literal, Optional, Tuple

from pydantic import BaseModel, field_validator

Objective = Literal["TIME", "DISTANCE"]
TimeWindow = Optional[Tuple[int, int]]


class SolveRequest(BaseModel):
    durationsSec: List[List[float]]
    distancesMeters: List[List[float]]
    objective: Objective
    timeWindows: Optional[List[TimeWindow]] = None
    serviceTimesSec: Optional[List[float]] = None

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
