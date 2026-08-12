from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from sgs_api.models import AuditEventRow


def csv_join(values: List[str]) -> str:
    return ",".join(values)


def csv_split(value: str) -> List[str]:
    if not value:
        return []
    return [v for v in value.split(",") if v]


def record_audit(
    db: Session,
    action: str,
    resource_type: str,
    resource_id: str,
    rf_ids: List[str],
    **detail: Any,
) -> AuditEventRow:
    ev = AuditEventRow(
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        rf_ids_csv=csv_join(rf_ids),
        detail_json=json.dumps(detail, ensure_ascii=False, default=str),
    )
    db.add(ev)
    db.flush()
    return ev


def detail_dict(ev: AuditEventRow) -> Dict[str, Any]:
    try:
        return json.loads(ev.detail_json or "{}")
    except json.JSONDecodeError:
        return {}
