from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_solve_endpoint_returns_expected_contract_shape():
    payload = {
        "durationsSec": [[0, 100, 200], [100, 0, 100], [200, 100, 0]],
        "distancesMeters": [[0, 100, 200], [100, 0, 100], [200, 100, 0]],
        "objective": "TIME",
    }
    resp = client.post("/solve", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) == {
        "sequence",
        "totalDistanceMeters",
        "totalDurationSec",
        "solverTimeMs",
        "feasible",
    }
    assert body["sequence"][0] == 0
    assert body["sequence"][-1] == 0
    assert body["feasible"] is True


def test_solve_endpoint_rejects_mismatched_matrix_sizes():
    payload = {
        "durationsSec": [[0, 100], [100, 0]],
        "distancesMeters": [[0, 100, 200], [100, 0, 100], [200, 100, 0]],
        "objective": "TIME",
    }
    resp = client.post("/solve", json=payload)
    assert resp.status_code == 422


def test_solve_endpoint_rejects_matrix_over_max_size():
    n = 51  # over MAX_MATRIX_SIZE (50)
    row = [1.0] * n
    payload = {
        "durationsSec": [row for _ in range(n)],
        "distancesMeters": [row for _ in range(n)],
        "objective": "TIME",
    }
    resp = client.post("/solve", json=payload)
    assert resp.status_code == 422


def test_docs_endpoints_are_disabled():
    # Internal-only service — no reason to expose interactive API docs.
    assert client.get("/docs").status_code == 404
    assert client.get("/redoc").status_code == 404
    assert client.get("/openapi.json").status_code == 404
