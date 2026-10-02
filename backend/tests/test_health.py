def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "SCHOLARAi API"
    assert data["phase"] == "Phase 1 — Foundation"
    assert data["database"] == "connected"
    assert "AI assists. Official sources decide. Student approves." in data["trust_principle"]


def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "SCHOLARAi API" in data["message"]
