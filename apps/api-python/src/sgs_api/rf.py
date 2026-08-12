from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class RfTipo(str, Enum):
    OBRIGATORIO = "Obrigatório"
    DESEJAVEL = "Desejável"


class RfFonte(str, Enum):
    ESUS = "e-SUS"
    TR = "TR"
    AMBOS = "ambos"


@dataclass(frozen=True)
class RfRef:
    """Referência a um requisito do TR para rastreabilidade e testes de faturamento."""

    id: str
    tipo: RfTipo
    fonte: RfFonte
    teste_faturamento: str = "n/a"
    nota: str = ""


# Âncoras P0 — organização / plataforma / produção
RF_FACILITY_LIST = RfRef("RF-2.47", RfTipo.OBRIGATORIO, RfFonte.AMBOS, "n/a", "Listagem de unidades")
RF_PROFESSIONAL = RfRef("RF-2.2", RfTipo.OBRIGATORIO, RfFonte.AMBOS, "n/a", "Cadastro profissional")
RF_TEAM = RfRef("RF-2.19", RfTipo.OBRIGATORIO, RfFonte.AMBOS, "n/a", "Equipes")
RF_PATIENT = RfRef("RF-2.27", RfTipo.OBRIGATORIO, RfFonte.AMBOS, "n/a", "Cadastro de pacientes")
RF_PATIENT_LIST = RfRef("RF-2.56", RfTipo.OBRIGATORIO, RfFonte.AMBOS, "n/a", "Listagem de pacientes")
RF_TERRITORY = RfRef("RF-2.29", RfTipo.OBRIGATORIO, RfFonte.AMBOS, "n/a", "Cadastro domiciliar/territorial APS")
RF_AUDIT = RfRef("RF-1.14", RfTipo.OBRIGATORIO, RfFonte.TR, "n/a", "Auditoria")
RF_ESUS_INTEG = RfRef("RF-10.3", RfTipo.OBRIGATORIO, RfFonte.ESUS, "previsto", "Integração / produção e-SUS")
RF_PROD_EXPORT = RfRef("RF-10.20", RfTipo.OBRIGATORIO, RfFonte.ESUS, "previsto", "Exportação / produção")
