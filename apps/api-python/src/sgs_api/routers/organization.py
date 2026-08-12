from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from sgs_api.audit_util import record_audit
from sgs_api.db import get_db
from sgs_api.models import FacilityRow, ProfessionalRow, TeamRow
from sgs_api.rf import RF_FACILITY_LIST, RF_PROFESSIONAL, RF_TEAM
from sgs_api.schemas import (
    FacilityOut,
    FacilityWrite,
    ProfessionalOut,
    ProfessionalWrite,
    TeamOut,
    TeamWrite,
)

router = APIRouter(prefix="/api/v1", tags=["organization"])


def _facility_out(f: FacilityRow) -> FacilityOut:
    return FacilityOut(
        id=f.id,
        cnes=f.cnes,
        name=f.name,
        active=f.active,
        cnpj=f.cnpj,
        type_id=f.type_id,
        created_at=f.created_at,
    )


def _professional_out(p: ProfessionalRow) -> ProfessionalOut:
    return ProfessionalOut(
        id=p.id,
        civil_name=p.civil_name,
        cpf=p.cpf,
        cns=p.cns,
        social_name=p.social_name,
        display_name=p.display_name,
        created_at=p.created_at,
    )


def _team_out(t: TeamRow) -> TeamOut:
    return TeamOut(
        id=t.id,
        facility_id=t.facility_id,
        name=t.name,
        team_type_id=t.team_type_id,
        active=t.active,
        ine=t.ine,
        created_at=t.created_at,
    )


@router.get("/facilities", response_model=List[FacilityOut])
def list_facilities(
    q: Optional[str] = Query(None),
    active: Optional[bool] = None,
    db: Session = Depends(get_db),
) -> List[FacilityOut]:
    """RF-2.47 — listagem de unidades (Obrigatório, fonte ambos)."""
    stmt = select(FacilityRow)
    if active is not None:
        stmt = stmt.where(FacilityRow.active.is_(active))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(FacilityRow.name.ilike(like), FacilityRow.cnes.ilike(like)))
    return [_facility_out(f) for f in db.scalars(stmt).all()]


@router.post("/facilities", response_model=FacilityOut, status_code=201)
def create_facility(body: FacilityWrite, db: Session = Depends(get_db)) -> FacilityOut:
    f = FacilityRow(**body.model_dump())
    db.add(f)
    db.flush()
    record_audit(db, "create", "facility", f.id, [RF_FACILITY_LIST.id], cnes=f.cnes)
    db.commit()
    db.refresh(f)
    return _facility_out(f)


@router.get("/facilities/{facility_id}", response_model=FacilityOut)
def get_facility(facility_id: str, db: Session = Depends(get_db)) -> FacilityOut:
    f = db.get(FacilityRow, facility_id)
    if not f:
        raise HTTPException(404, "Unidade não encontrada")
    return _facility_out(f)


@router.get("/professionals", response_model=List[ProfessionalOut])
def list_professionals(q: Optional[str] = Query(None), db: Session = Depends(get_db)) -> List[ProfessionalOut]:
    stmt = select(ProfessionalRow)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                ProfessionalRow.civil_name.ilike(like),
                ProfessionalRow.social_name.ilike(like),
                ProfessionalRow.cpf.ilike(like),
                ProfessionalRow.cns.ilike(like),
            )
        )
    return [_professional_out(p) for p in db.scalars(stmt).all()]


@router.post("/professionals", response_model=ProfessionalOut, status_code=201)
def create_professional(body: ProfessionalWrite, db: Session = Depends(get_db)) -> ProfessionalOut:
    p = ProfessionalRow(**body.model_dump())
    db.add(p)
    db.flush()
    record_audit(db, "create", "professional", p.id, [RF_PROFESSIONAL.id])
    db.commit()
    db.refresh(p)
    return _professional_out(p)


@router.get("/teams", response_model=List[TeamOut])
def list_teams(facility_id: Optional[str] = None, db: Session = Depends(get_db)) -> List[TeamOut]:
    stmt = select(TeamRow)
    if facility_id:
        stmt = stmt.where(TeamRow.facility_id == facility_id)
    return [_team_out(t) for t in db.scalars(stmt).all()]


@router.post("/teams", response_model=TeamOut, status_code=201)
def create_team(body: TeamWrite, db: Session = Depends(get_db)) -> TeamOut:
    if not db.get(FacilityRow, body.facility_id):
        raise HTTPException(400, "facility_id inválido")
    t = TeamRow(**body.model_dump())
    db.add(t)
    db.flush()
    record_audit(db, "create", "team", t.id, [RF_TEAM.id], facility_id=t.facility_id)
    db.commit()
    db.refresh(t)
    return _team_out(t)
