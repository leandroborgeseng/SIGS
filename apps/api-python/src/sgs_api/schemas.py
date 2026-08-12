from __future__ import annotations

from datetime import date, datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class FacilityWrite(BaseModel):
    cnes: str = Field(..., max_length=20)
    name: str
    active: bool = True
    cnpj: Optional[str] = Field(None, max_length=14)
    type_id: Optional[str] = None


class FacilityOut(FacilityWrite):
    id: str
    created_at: datetime


class ProfessionalWrite(BaseModel):
    civil_name: str
    cpf: Optional[str] = Field(None, max_length=11)
    cns: Optional[str] = Field(None, max_length=16)
    social_name: Optional[str] = None


class ProfessionalOut(ProfessionalWrite):
    id: str
    display_name: str
    created_at: datetime


class TeamWrite(BaseModel):
    facility_id: str
    name: str
    team_type_id: str
    active: bool = True
    ine: Optional[str] = None


class TeamOut(TeamWrite):
    id: str
    created_at: datetime


class PatientWrite(BaseModel):
    civil_name: str
    social_name: Optional[str] = None
    cpf: Optional[str] = Field(None, max_length=11)
    cns: Optional[str] = Field(None, max_length=16)
    birth_date: date
    sex: str
    race_color: Optional[str] = None
    mother_name: Optional[str] = None
    mother_name_unknown: bool = False
    father_name: Optional[str] = None
    father_name_unknown: bool = False
    is_deceased: bool = False
    death_date: Optional[date] = None
    death_certificate: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None


class PatientOut(PatientWrite):
    id: str
    display_name: str
    created_at: datetime


class MicroAreaWrite(BaseModel):
    team_id: str
    code: str = Field(..., max_length=16)
    name: str
    active: bool = True


class MicroAreaOut(MicroAreaWrite):
    id: str
    created_at: datetime


class PatientTeamLinkWrite(BaseModel):
    patient_id: str
    team_id: str
    micro_area_id: Optional[str] = None
    active: bool = True


class PatientTeamLinkOut(PatientTeamLinkWrite):
    id: str
    created_at: datetime


class ProductionEnqueue(BaseModel):
    kind: str = Field(..., description="individual_encounter | vaccination | stub")
    payload: Dict
    rf_ids: List[str] = Field(default_factory=list)


class ProductionOut(BaseModel):
    id: str
    kind: str
    status: str
    rf_ids: List[str]
    payload: Dict
    created_at: datetime


class AuditOut(BaseModel):
    id: str
    action: str
    resource_type: str
    resource_id: str
    rf_ids: List[str]
    detail: Dict
    at: datetime


class RfMeta(BaseModel):
    id: str
    tipo: str
    fonte: str
    teste_faturamento: str
    nota: str = ""


class HealthOut(BaseModel):
    status: str
    version: str
    phase: str
    ui: str
    database: str
