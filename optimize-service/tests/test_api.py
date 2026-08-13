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
