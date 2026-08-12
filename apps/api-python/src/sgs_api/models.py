from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from sgs_api.db import Base


def _uuid() -> str:
    return str(uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class FacilityRow(Base):
    __tablename__ = "facilities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    cnes: Mapped[str] = mapped_column(String(20), index=True)
    name: Mapped[str] = mapped_column(String(255))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    cnpj: Mapped[Optional[str]] = mapped_column(String(14), nullable=True)
    type_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class ProfessionalRow(Base):
    __tablename__ = "professionals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    civil_name: Mapped[str] = mapped_column(String(255))
    social_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    cpf: Mapped[Optional[str]] = mapped_column(String(11), nullable=True, index=True)
    cns: Mapped[Optional[str]] = mapped_column(String(16), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    @property
    def display_name(self) -> str:
        return self.social_name or self.civil_name


class TeamRow(Base):
    __tablename__ = "teams"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    facility_id: Mapped[str] = mapped_column(String(36), ForeignKey("facilities.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    team_type_id: Mapped[str] = mapped_column(String(64))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    ine: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class PatientRow(Base):
    __tablename__ = "patients"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    civil_name: Mapped[str] = mapped_column(String(255), index=True)
    social_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    cpf: Mapped[Optional[str]] = mapped_column(String(11), nullable=True, index=True)
    cns: Mapped[Optional[str]] = mapped_column(String(16), nullable=True, index=True)
    birth_date: Mapped[date] = mapped_column(Date)
    sex: Mapped[str] = mapped_column(String(16))
    race_color: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    mother_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    mother_name_unknown: Mapped[bool] = mapped_column(Boolean, default=False)
    father_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    father_name_unknown: Mapped[bool] = mapped_column(Boolean, default=False)
    is_deceased: Mapped[bool] = mapped_column(Boolean, default=False)
    death_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    death_certificate: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    @property
    def display_name(self) -> str:
        return self.social_name or self.civil_name


class MicroAreaRow(Base):
    __tablename__ = "micro_areas"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    team_id: Mapped[str] = mapped_column(String(36), ForeignKey("teams.id"), index=True)
    code: Mapped[str] = mapped_column(String(16))
    name: Mapped[str] = mapped_column(String(255))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class PatientTeamLinkRow(Base):
    __tablename__ = "patient_team_links"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    patient_id: Mapped[str] = mapped_column(String(36), ForeignKey("patients.id"), index=True)
    team_id: Mapped[str] = mapped_column(String(36), ForeignKey("teams.id"), index=True)
    micro_area_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("micro_areas.id"), nullable=True
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class ProductionBatchRow(Base):
    __tablename__ = "production_batches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    kind: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default="draft")
    rf_ids_csv: Mapped[str] = mapped_column(Text, default="")
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class AuditEventRow(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    action: Mapped[str] = mapped_column(String(64))
    resource_type: Mapped[str] = mapped_column(String(64))
    resource_id: Mapped[str] = mapped_column(String(36), index=True)
    rf_ids_csv: Mapped[str] = mapped_column(Text, default="")
    detail_json: Mapped[str] = mapped_column(Text, default="{}")
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
