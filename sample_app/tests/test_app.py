import pytest
from sample_app.app import get_status_dict, VERSION, ENVIRONMENT, HAS_FLASK


def test_status_dict():
    status = get_status_dict()
    assert status["status"] == "healthy"
    assert status["version"] == VERSION
    assert status["environment"] == ENVIRONMENT
    assert "uptime_seconds" in status


def test_simulated_failure(monkeypatch):
    monkeypatch.setenv("SIMULATE_HEALTH_FAILURE", "true")
    status = get_status_dict()
    assert status["status"] == "unhealthy"


def test_flask_or_handler():
    # If Flask is installed, verify Flask client; otherwise verify fallback structure
    if HAS_FLASK:
        from sample_app.app import app
        app.config["TESTING"] = True
        with app.test_client() as client:
            res = client.get("/health")
            assert res.status_code == 200
            data = res.get_json()
            assert data["status"] == "healthy"
    else:
        status = get_status_dict()
        assert status["status"] in ("healthy", "unhealthy")
