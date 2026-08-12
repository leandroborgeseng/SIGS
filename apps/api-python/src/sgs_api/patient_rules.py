from __future__ import annotations

from datetime import date
from typing import List, Optional

from fastapi import HTTPException

from sgs_api.schemas import PatientWrite


def validate_patient_write(body: PatientWrite) -> None:
    """Regras de domínio (design + specs patient) — também no backend."""
    errors: List[str] = []

    if body.birth_date > date.today():
        errors.append("birth_date não pode ser futura")

    if body.mother_name_unknown:
        if body.mother_name:
            errors.append("mother_name deve estar vazio quando mother_name_unknown=true")
    elif not (body.mother_name and body.mother_name.strip()):
        errors.append("mother_name é obrigatório (ou marque mother_name_unknown)")

    if body.father_name_unknown and body.father_name:
        errors.append("father_name deve estar vazio quando father_name_unknown=true")

    if body.is_deceased:
        if not body.death_date:
            errors.append("death_date obrigatório quando is_deceased=true")
        elif body.death_date < body.birth_date:
            errors.append("death_date não pode ser anterior a birth_date")
        if not (body.death_certificate and body.death_certificate.strip()):
            errors.append("death_certificate obrigatório quando is_deceased=true")
    else:
        if body.death_date or body.death_certificate:
            errors.append("campos de óbito só são permitidos quando is_deceased=true")

    if body.cpf and len(body.cpf) != 11:
        errors.append("cpf deve ter 11 dígitos")
    if body.cns and not (15 <= len(body.cns) <= 16):
        errors.append("cns deve ter 15 ou 16 dígitos")

    if errors:
        raise HTTPException(status_code=422, detail={"errors": errors})
