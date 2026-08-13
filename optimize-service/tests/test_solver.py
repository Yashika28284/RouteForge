"""Unit tests for app.solver.tsp_solver.solve.

Matrices below are hand-built with a verifiably-correct optimal answer
(computed either geometrically or by brute-force enumeration in the test
itself), not just "it returns something".
"""
import itertools

from app.solver.tsp_solver import solve

# Unit square, depot at node 0:
#   0 = (0, 0)   1 = (0, 1)
#   3 = (1, 0)   2 = (1, 1)
# Perimeter edges = 1000m, diagonals = 1414m (sqrt(2) * 1000, rounded).
SQUARE_DISTANCES = [
    [0, 1000, 1414, 1000],
    [1000, 0, 1000, 1414],
    [1414, 1000, 0, 1000],
    [1000, 1414, 1000, 0],
]
# Use the same numbers as "seconds" for a TIME-objective test.
SQUARE_DURATIONS = SQUARE_DISTANCES


def _brute_force_optimal(matrix):
    n = len(matrix)
    best = None
    for perm in itertools.permutations(range(1, n)):
        route = [0, *perm, 0]
        cost = sum(matrix[route[i]][route[i + 1]] for i in range(len(route) - 1))
        if best is None or cost < best:
            best = cost
    return best


def test_square_distance_objective_finds_perimeter_tour():
    result = solve(
        durations_sec=SQUARE_DURATIONS,
        distances_meters=SQUARE_DISTANCES,
        objective="DISTANCE",
    )
    assert result.feasible is True
    assert result.sequence[0] == 0
    assert result.sequence[-1] == 0
    assert set(result.sequence) == {0, 1, 2, 3}
    expected_optimal = _brute_force_optimal(SQUARE_DISTANCES)
    assert expected_optimal == 4000  # perimeter: four sides of 1000m
    assert result.totalDistanceMeters == expected_optimal


def test_square_time_objective_finds_perimeter_tour():
    result = solve(
        durations_sec=SQUARE_DURATIONS,
        distances_meters=SQUARE_DISTANCES,
        objective="TIME",
    )
    assert result.feasible is True
    expected_optimal = _brute_force_optimal(SQUARE_DURATIONS)
    assert result.totalDurationSec == expected_optimal


def test_single_node_depot_only_is_trivially_feasible():
    result = solve(
        durations_sec=[[0]],
        distances_meters=[[0]],
        objective="TIME",
    )
    assert result.feasible is True
    assert result.sequence == [0, 0]
    assert result.totalDistanceMeters == 0
    assert result.totalDurationSec == 0


def test_empty_matrix_is_not_feasible():
    result = solve(durations_sec=[], distances_meters=[], objective="TIME")
    assert result.feasible is False
    assert result.sequence == []


def test_satisfiable_time_windows_are_respected():
    # 3 stops in a line: depot(0) -- 100s -- stop1 -- 100s -- stop2.
    durations = [
        [0, 100, 200],
        [100, 0, 100],
        [200, 100, 0],
    ]
    distances = durations
    # Force visiting stop2 before stop1 is impossible within these windows
    # only if arrival times don't fit; here windows are generous, so any
    # order that respects them is feasible.
    time_windows = [None, [50, 5000], [50, 5000]]
    result = solve(
        durations_sec=durations,
        distances_meters=distances,
        objective="TIME",
        time_windows=time_windows,
        service_times_sec=[0, 0, 0],
    )
    assert result.feasible is True
    assert set(result.sequence) == {0, 1, 2}


def test_impossible_time_windows_are_infeasible():
    # stop1 must be visited in [0, 10]s but it's 100s away from the depot,
    # and the vehicle cannot start before t=0 — infeasible.
    durations = [
        [0, 100],
        [100, 0],
    ]
    distances = durations
    time_windows = [None, [0, 10]]
    result = solve(
        durations_sec=durations,
        distances_meters=distances,
        objective="TIME",
        time_windows=time_windows,
        service_times_sec=[0, 0],
    )
    assert result.feasible is False
