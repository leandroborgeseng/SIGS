from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from sgs_api.audit_util import record_audit
from sgs_api.db import get_db
from sgs_api.models import MicroAreaRow, PatientRow, PatientTeamLinkRow, TeamRow
from sgs_api.rf import RF_TERRITORY
from sgs_api.schemas import MicroAreaOut, MicroAreaWrite, PatientTeamLinkOut, PatientTeamLinkWrite

router = APIRouter(prefix="/api/v1", tags=["territory"])


def _micro_out(m: MicroAreaRow) -> MicroAreaOut:
    return MicroAreaOut(
        id=m.id,
        team_id=m.team_id,
        code=m.code,
        name=m.name,
        active=m.active,
        created_at=m.created_at,
    )


def _link_out(link: PatientTeamLinkRow) -> PatientTeamLinkOut:
    return PatientTeamLinkOut(
        id=link.id,
        patient_id=link.patient_id,
        team_id=link.team_id,
        micro_area_id=link.micro_area_id,
        active=link.active,
        created_at=link.created_at,
    )


@router.get("/micro-areas", response_model=List[MicroAreaOut])
def list_micro_areas(
    team_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
) -> List[MicroAreaOut]:
    """RF-2.29 — microáreas (recorte territorial básico)."""
    stmt = select(MicroAreaRow)
    if team_id:
        stmt = stmt.where(MicroAreaRow.team_id == team_id)
    return [_micro_out(m) for m in db.scalars(stmt).all()]


@router.post("/micro-areas", response_model=MicroAreaOut, status_code=201)
def create_micro_area(body: MicroAreaWrite, db: Session = Depends(get_db)) -> MicroAreaOut:
    if not db.get(TeamRow, body.team_id):
        raise HTTPException(400, "team_id inválido")
    m = MicroAreaRow(**body.model_dump())
    db.add(m)
    db.flush()
    record_audit(db, "create", "micro_area", m.id, [RF_TERRITORY.id], team_id=m.team_id)
    db.commit()
    db.refresh(m)
    return _micro_out(m)


@router.get("/patient-team-links", response_model=List[PatientTeamLinkOut])
def list_links(
    patient_id: Optional[str] = None,
    team_id: Optional[str] = None,
    db: Session = Depends(get_db),
) -> List[PatientTeamLinkOut]:
    stmt = select(PatientTeamLinkRow)
    if patient_id:
        stmt = stmt.where(PatientTeamLinkRow.patient_id == patient_id)
    if team_id:
        stmt = stmt.where(PatientTeamLinkRow.team_id == team_id)
    return [_link_out(x) for x in db.scalars(stmt).all()]


@router.post("/patient-team-links", response_model=PatientTeamLinkOut, status_code=201)
def create_link(body: PatientTeamLinkWrite, db: Session = Depends(get_db)) -> PatientTeamLinkOut:
    if not db.get(PatientRow, body.patient_id):
        raise HTTPException(400, "patient_id inválido")
    if not db.get(TeamRow, body.team_id):
        raise HTTPException(400, "team_id inválido")
    if body.micro_area_id:
        ma = db.get(MicroAreaRow, body.micro_area_id)
        if not ma:
            raise HTTPException(400, "micro_area_id inválido")
        if ma.team_id != body.team_id:
            raise HTTPException(400, "micro_area não pertence à equipe informada")
    link = PatientTeamLinkRow(**body.model_dump())
    db.add(link)
    db.flush()
    record_audit(db, "create", "patient_team_link", link.id, [RF_TERRITORY.id])
    db.commit()
    db.refresh(link)
    return _link_out(link)
