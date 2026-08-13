# Manual técnico — Agenda (AppointmentSlot)

**RF:** RF-12.1 (parcial), RF-2.17, RF-2.36 (parcial), RF-3.5 (parcial)  
**Atualizado:** 2026-08-13

Modelo único `appointment_slots` (não copiar e-SUS). Sem SAMU.

## Campos novos

| Campo | Valores | LEDI na abertura |
|---|---|---|
| `item_type` | `CONSULTA` (default) · `ENCAIXE` | tipoAtendimento **2** · **5** |
| `care_line` | `GENERAL` (default) · `ODONTO` · `APS` | escolhe `open-dental` vs `open-aps` |

Odonto recusa `careLine=APS`. APS recusa `careLine=ODONTO`. `GENERAL` abre nos dois fluxos.

FAO tipo 2 preenche `tiposConsultaOdonto=[1]`; encaixe (tipo 5) deixa vazio.

## Endpoints

| Método | Path |
|---|---|
| GET | `/api/v1/appointments/catalog` |
| GET | `/api/v1/appointments/day-grid?from&to&facilityId&careLine&slotMinutes` |
| GET | `/api/v1/appointments?from&to&facilityId&careLine=ODONTO,GENERAL` |
| POST | `/api/v1/appointments` body `itemType` `careLine` |
| POST | `/api/v1/appointments/:id/open-dental` |
| POST | `/api/v1/appointments/:id/open-aps` |

`careLine` na query aceita lista CSV. Grade: o item entra na faixa que contém o **início**; intervalo 15–60 min (default 30).

## UI

- `/odonto/agenda` — `careLine=ODONTO,GENERAL` → `/odonto/[id]`
- `/aps/agenda` — `careLine=APS,GENERAL` → `/aps/[id]`
- `/agenda` — lista da semana (todos os careLine)

## Fora deste MVP

Cadastro livre de tipos de item, salas, grade municipal compartilhada, encaixe automático, SAMU/TFD.
