from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from sgs_api import __version__
from sgs_api.audit_util import csv_split, detail_dict
from sgs_api.db import DATABASE_URL, get_db
from sgs_api.models import AuditEventRow
from sgs_api.rf import (
    RF_AUDIT,
    RF_ESUS_INTEG,
    RF_FACILITY_LIST,
    RF_PATIENT,
    RF_PATIENT_LIST,
    RF_PROD_EXPORT,
    RF_PROFESSIONAL,
    RF_TEAM,
    RF_TERRITORY,
)
from sgs_api.schemas import AuditOut, HealthOut, RfMeta

router = APIRouter(tags=["platform"])

_RF_CATALOG = [
    RF_FACILITY_LIST,
    RF_PROFESSIONAL,
    RF_TEAM,
    RF_PATIENT,
    RF_PATIENT_LIST,
    RF_TERRITORY,
    RF_AUDIT,
    RF_ESUS_INTEG,
    RF_PROD_EXPORT,
]


@router.get("/health", response_model=HealthOut)
def health() -> HealthOut:
    dialect = "sqlite" if DATABASE_URL.startswith("sqlite") else "postgres"
    return HealthOut(
        status="ok",
        version=__version__,
        phase="rewrite-backend-first",
        ui="deferred-claude-design",
        database=dialect,
    )


@router.get("/api/v1/rf/anchors", response_model=List[RfMeta])
def rf_anchors() -> List[RfMeta]:
    return [
        RfMeta(
            id=r.id,
            tipo=r.tipo.value,
            fonte=r.fonte.value,
            teste_faturamento=r.teste_faturamento,
            nota=r.nota,
        )
        for r in _RF_CATALOG
    ]


@router.get("/api/v1/audit", response_model=List[AuditOut])
def list_audit(limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db)) -> List[AuditOut]:
    events = db.scalars(select(AuditEventRow).order_by(AuditEventRow.at.desc()).limit(limit)).all()
    return [
        AuditOut(
            id=e.id,
            action=e.action,
            resource_type=e.resource_type,
            resource_id=e.resource_id,
            rf_ids=csv_split(e.rf_ids_csv),
            detail=detail_dict(e),
            at=e.at,
        )
        for e in events
    ]
