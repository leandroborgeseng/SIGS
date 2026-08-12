from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from sgs_api.audit_util import record_audit
from sgs_api.db import get_db
from sgs_api.models import PatientRow
from sgs_api.patient_rules import validate_patient_write
from sgs_api.rf import RF_PATIENT, RF_PATIENT_LIST
from sgs_api.schemas import PatientOut, PatientWrite

router = APIRouter(prefix="/api/v1", tags=["patients"])


def _out(p: PatientRow) -> PatientOut:
    return PatientOut(
        id=p.id,
        civil_name=p.civil_name,
        social_name=p.social_name,
        cpf=p.cpf,
        cns=p.cns,
        birth_date=p.birth_date,
        sex=p.sex,
        race_color=p.race_color,
        mother_name=p.mother_name,
        mother_name_unknown=p.mother_name_unknown,
        father_name=p.father_name,
        father_name_unknown=p.father_name_unknown,
        is_deceased=p.is_deceased,
        death_date=p.death_date,
        death_certificate=p.death_certificate,
        phone=p.phone,
        notes=p.notes,
        display_name=p.display_name,
        created_at=p.created_at,
    )


@router.get("/patients", response_model=List[PatientOut])
def search_patients(
    q: Optional[str] = Query(None, description="Nome, CPF, CNS ou nome da mãe"),
    birth_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
) -> List[PatientOut]:
    """RF-2.56 — listagem/busca de pacientes."""
    stmt = select(PatientRow)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                PatientRow.civil_name.ilike(like),
                PatientRow.social_name.ilike(like),
                PatientRow.cpf.ilike(like),
                PatientRow.cns.ilike(like),
                PatientRow.mother_name.ilike(like),
            )
        )
    if birth_date:
        stmt = stmt.where(PatientRow.birth_date == birth_date)
    return [_out(p) for p in db.scalars(stmt).all()]


@router.post("/patients", response_model=PatientOut, status_code=201)
def create_patient(body: PatientWrite, db: Session = Depends(get_db)) -> PatientOut:
    """RF-2.27 — cadastro de pacientes (parcial MVP)."""
    validate_patient_write(body)
    p = PatientRow(**body.model_dump())
    db.add(p)
    db.flush()
    record_audit(db, "create", "patient", p.id, [RF_PATIENT.id, RF_PATIENT_LIST.id])
    db.commit()
    db.refresh(p)
    return _out(p)


@router.get("/patients/{patient_id}", response_model=PatientOut)
def get_patient(patient_id: str, db: Session = Depends(get_db)) -> PatientOut:
    p = db.get(PatientRow, patient_id)
    if not p:
        raise HTTPException(404, "Paciente não encontrado")
    return _out(p)


@router.put("/patients/{patient_id}", response_model=PatientOut)
def update_patient(patient_id: str, body: PatientWrite, db: Session = Depends(get_db)) -> PatientOut:
    validate_patient_write(body)
    p = db.get(PatientRow, patient_id)
    if not p:
        raise HTTPException(404, "Paciente não encontrado")
    for key, value in body.model_dump().items():
        setattr(p, key, value)
    record_audit(db, "update", "patient", p.id, [RF_PATIENT.id])
    db.commit()
    db.refresh(p)
    return _out(p)
