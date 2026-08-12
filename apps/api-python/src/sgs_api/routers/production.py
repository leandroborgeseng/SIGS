from __future__ import annotations

import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from sgs_api.audit_util import csv_join, csv_split, record_audit
from sgs_api.db import get_db
from sgs_api.models import ProductionBatchRow
from sgs_api.rf import RF_ESUS_INTEG, RF_PROD_EXPORT
from sgs_api.schemas import ProductionEnqueue, ProductionOut

router = APIRouter(prefix="/api/v1/production", tags=["production"])


def _out(b: ProductionBatchRow) -> ProductionOut:
    return ProductionOut(
        id=b.id,
        kind=b.kind,
        status=b.status,
        rf_ids=csv_split(b.rf_ids_csv),
        payload=json.loads(b.payload_json or "{}"),
        created_at=b.created_at,
    )


@router.get("/batches", response_model=List[ProductionOut])
def list_batches(status: Optional[str] = None, db: Session = Depends(get_db)) -> List[ProductionOut]:
    stmt = select(ProductionBatchRow)
    if status:
        stmt = stmt.where(ProductionBatchRow.status == status)
    return [_out(b) for b in db.scalars(stmt).all()]


@router.post("/batches", response_model=ProductionOut, status_code=201)
def enqueue_batch(body: ProductionEnqueue, db: Session = Depends(get_db)) -> ProductionOut:
    """Enfileira payload LEDI-ready para teste de faturamento/produção parcial."""
    rf_ids = body.rf_ids or [RF_ESUS_INTEG.id, RF_PROD_EXPORT.id]
    batch = ProductionBatchRow(
        kind=body.kind,
        payload_json=json.dumps(body.payload, ensure_ascii=False),
        rf_ids_csv=csv_join(rf_ids),
        status="ready",
    )
    db.add(batch)
    db.flush()
    record_audit(db, "enqueue", "production_batch", batch.id, rf_ids, kind=body.kind)
    db.commit()
    db.refresh(batch)
    return _out(batch)


@router.post("/batches/{batch_id}/mark-sent", response_model=ProductionOut)
def mark_sent(batch_id: str, db: Session = Depends(get_db)) -> ProductionOut:
    batch = db.get(ProductionBatchRow, batch_id)
    if not batch:
        raise HTTPException(404, "Lote não encontrado")
    batch.status = "sent"
    record_audit(db, "mark_sent", "production_batch", batch.id, csv_split(batch.rf_ids_csv))
    db.commit()
    db.refresh(batch)
    return _out(batch)


@router.get("/batches/{batch_id}", response_model=ProductionOut)
def get_batch(batch_id: str, db: Session = Depends(get_db)) -> ProductionOut:
    batch = db.get(ProductionBatchRow, batch_id)
    if not batch:
        raise HTTPException(404, "Lote não encontrado")
    return _out(batch)
