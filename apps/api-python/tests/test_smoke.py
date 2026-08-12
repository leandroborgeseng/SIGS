from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from sgs_api.db import Base, get_db
from sgs_api.main import app
import sgs_api.models  # noqa: F401


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    def _override():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


def test_health(client: TestClient):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["ui"] == "deferred-claude-design"
    assert "database" in body


def test_rf_anchors_include_patient_territory(client: TestClient):
    r = client.get("/api/v1/rf/anchors")
    assert r.status_code == 200
    ids = {x["id"]: x for x in r.json()}
    assert ids["RF-2.27"]["tipo"] == "Obrigatório"
    assert ids["RF-2.29"]["fonte"] == "ambos"
    assert ids["RF-10.3"]["teste_faturamento"] == "previsto"


def test_facility_team_patient_territory_flow(client: TestClient):
    f = client.post("/api/v1/facilities", json={"cnes": "1234567", "name": "UBS Centro", "active": True})
    assert f.status_code == 201
    facility_id = f.json()["id"]

    t = client.post(
        "/api/v1/teams",
        json={
            "facility_id": facility_id,
            "name": "ESF 01",
            "team_type_id": "ESF",
            "ine": "0000000001",
            "active": True,
        },
    )
    assert t.status_code == 201
    team_id = t.json()["id"]

    bad = client.post(
        "/api/v1/patients",
        json={
            "civil_name": "Maria Exemplo Silva",
            "birth_date": "1990-05-10",
            "sex": "FEMALE",
            "mother_name_unknown": False,
        },
    )
    assert bad.status_code == 422

    p = client.post(
        "/api/v1/patients",
        json={
            "civil_name": "Maria Exemplo Silva",
            "social_name": "Maria Social",
            "cpf": "12345678901",
            "cns": "123456789012345",
            "birth_date": "1990-05-10",
            "sex": "FEMALE",
            "mother_name": "Ana Exemplo",
            "father_name_unknown": True,
        },
    )
    assert p.status_code == 201
    assert p.json()["display_name"] == "Maria Social"
    patient_id = p.json()["id"]

    listed = client.get("/api/v1/patients", params={"q": "Maria"})
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    ma = client.post(
        "/api/v1/micro-areas",
        json={"team_id": team_id, "code": "01", "name": "Microárea 01", "active": True},
    )
    assert ma.status_code == 201
    micro_id = ma.json()["id"]

    link = client.post(
        "/api/v1/patient-team-links",
        json={
            "patient_id": patient_id,
            "team_id": team_id,
            "micro_area_id": micro_id,
            "active": True,
        },
    )
    assert link.status_code == 201


def test_deceased_requires_death_fields(client: TestClient):
    r = client.post(
        "/api/v1/patients",
        json={
            "civil_name": "João Falecido",
            "birth_date": "1950-01-01",
            "sex": "MALE",
            "mother_name_unknown": True,
            "is_deceased": True,
        },
    )
    assert r.status_code == 422

    ok = client.post(
        "/api/v1/patients",
        json={
            "civil_name": "João Falecido",
            "birth_date": "1950-01-01",
            "sex": "MALE",
            "mother_name_unknown": True,
            "is_deceased": True,
            "death_date": "2020-03-15",
            "death_certificate": "12345",
        },
    )
    assert ok.status_code == 201


def test_production_batch_for_billing_hook(client: TestClient):
    r = client.post(
        "/api/v1/production/batches",
        json={
            "kind": "stub",
            "payload": {"uuidFicha": "test-ficha-1", "tpCdsOrigem": 3},
            "rf_ids": ["RF-10.3", "RF-10.20"],
        },
    )
    assert r.status_code == 201
    batch_id = r.json()["id"]
    sent = client.post(f"/api/v1/production/batches/{batch_id}/mark-sent")
    assert sent.status_code == 200
    assert sent.json()["status"] == "sent"
