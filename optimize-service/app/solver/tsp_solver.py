"""OR-Tools based TSP solver with optional time-window constraints.

Implementation approach follows HANDOFF.md section 5a exactly:
RoutingIndexManager + RoutingModel, PATH_CHEAPEST_ARC first-solution
strategy + GUIDED_LOCAL_SEARCH metaheuristic with a bounded time limit,
and a cumulative "time" dimension (via AddDimension) to encode time
windows through CumulVar(index).SetRange(start, end).
"""
import time
from typing import List, Optional, Tuple

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

from app.schemas import SolveResponse

# Bounded solver time limit, per HANDOFF.md (2-5s).
SOLVER_TIME_LIMIT_SEC = 3

# OR-Tools works with integers; scale float seconds/meters up before
# truncating so sub-second/sub-meter differences aren't lost as costs.
_SCALE = 100


def _to_int_matrix(matrix: List[List[float]]) -> List[List[int]]:
    return [[round(v * _SCALE) for v in row] for row in matrix]


def solve(
    durations_sec: List[List[float]],
    distances_meters: List[List[float]],
    objective: str,
    time_windows: Optional[List[Optional[Tuple[int, int]]]] = None,
    service_times_sec: Optional[List[float]] = None,
) -> SolveResponse:
    n = len(durations_sec)
    depot = 0

    if n == 0:
        return SolveResponse(
            sequence=[],
            totalDistanceMeters=0,
            totalDurationSec=0,
            solverTimeMs=0,
            feasible=False,
        )

    if n == 1:
        # Only the depot: a trivial, already-optimal route.
        return SolveResponse(
            sequence=[0, 0],
            totalDistanceMeters=0,
            totalDurationSec=0,
            solverTimeMs=0,
            feasible=True,
        )

    service_times = service_times_sec or [0.0] * n
    cost_matrix = durations_sec if objective == "TIME" else distances_meters
    cost_matrix_int = _to_int_matrix(cost_matrix)
    duration_matrix_int = _to_int_matrix(durations_sec)
    service_times_int = [round(s) for s in service_times]

    manager = pywrapcp.RoutingIndexManager(n, 1, depot)
    routing = pywrapcp.RoutingModel(manager)

    def cost_callback(from_index: int, to_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return cost_matrix_int[from_node][to_node]

    cost_callback_index = routing.RegisterTransitCallback(cost_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(cost_callback_index)

    has_time_windows = bool(time_windows) and any(tw is not None for tw in time_windows)

    if has_time_windows:
        def time_callback(from_index: int, to_index: int) -> int:
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return duration_matrix_int[from_node][to_node] + service_times_int[from_node] * _SCALE

        time_callback_index = routing.RegisterTransitCallback(time_callback)

        # Horizon: sum of all possible travel + service time is a safe
        # upper bound for the cumulative "time" dimension.
        horizon = sum(sum(row) for row in duration_matrix_int) + sum(
            s * _SCALE for s in service_times_int
        ) + _SCALE * 24 * 3600

        routing.AddDimension(
            time_callback_index,
            horizon,  # allow waiting up to the full horizon
            horizon,  # max cumulative time per vehicle
            False,  # don't force cumulative to start at zero
            "Time",
        )
        time_dimension = routing.GetDimensionOrDie("Time")

        for node_index, window in enumerate(time_windows):
            if window is None:
                continue
            index = manager.NodeToIndex(node_index)
            start_sec, end_sec = window
            time_dimension.CumulVar(index).SetRange(
                round(start_sec * _SCALE), round(end_sec * _SCALE)
            )

        # Depot: let the vehicle start anytime within the overall horizon.
        depot_index = manager.NodeToIndex(depot)
        time_dimension.CumulVar(depot_index).SetRange(0, horizon)

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_parameters.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_parameters.time_limit.FromSeconds(SOLVER_TIME_LIMIT_SEC)

    start = time.monotonic()
    solution = routing.SolveWithParameters(search_parameters)
    solver_time_ms = round((time.monotonic() - start) * 1000)

    if solution is None:
        return SolveResponse(
            sequence=[],
            totalDistanceMeters=0,
            totalDurationSec=0,
            solverTimeMs=solver_time_ms,
            feasible=False,
        )

    sequence: List[int] = []
    index = routing.Start(0)
    while not routing.IsEnd(index):
        sequence.append(manager.IndexToNode(index))
        index = solution.Value(routing.NextVar(index))
    sequence.append(manager.IndexToNode(index))  # back to depot

    total_distance_meters = 0.0
    total_duration_sec = 0.0
    for i in range(len(sequence) - 1):
        a, b = sequence[i], sequence[i + 1]
        total_distance_meters += distances_meters[a][b]
        total_duration_sec += durations_sec[a][b]
        total_duration_sec += service_times[a]

    return SolveResponse(
        sequence=sequence,
        totalDistanceMeters=round(total_distance_meters, 2),
        totalDurationSec=round(total_duration_sec, 2),
        solverTimeMs=solver_time_ms,
        feasible=True,
    )
