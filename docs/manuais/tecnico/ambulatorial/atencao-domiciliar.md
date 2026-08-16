---
id: ambulatorial.atencao-domiciliar
title: Atenção domiciliar (AD)
type: technical
module: ambulatorial
feature: home-care
version: 0.3.0
product_min: 0.1.0
status: published
audience: [ti, desenvolvedor]
related_rf: [RF-3.54, RF-10.4]
related_screens: [/ad, /producao]
updated_at: 2026-08-16
---

# Atenção domiciliar — técnico

## API

| Método | Rota |
|---|---|
| GET | `/api/v1/catalog/home-care` |
| GET/POST | `/api/v1/home-care-visits` |
| GET | `/api/v1/home-care-visits/:id` |
| POST | `/api/v1/home-care-visits/:id/children` |
| DELETE | `/api/v1/home-care-visits/:id/children/:patientId` |
| POST | `/api/v1/home-care-visits/:id/finish` |

- `careType` ∈ `AD1|AD2|AD3`; `shift` ∈ `MANHA|TARDE|NOITE`
- Open aceita `patientId` **ou** `patientIds[]` **ou** `children[]` (máx. 99 — regra LEDI master)
- Persistência: `children_json` + `patient_id` âncora (1º child)
- Finish → `production_batches.kind = home_care` · payload `atendimentosDomiciliares[]` · BPA qty = N children · SIGTAP `0101040024`
- Campos LEDI por child: modalidade, turno, local, tipo (7/8/9), desfecho, `condicoesAvaliadas`, CIAP/CID, `stCidadaoNaoPossuiCpf`

## Testes

- `ledi-care-extra.mapper.spec.ts` — single + multi-child
- `care-extra.service.spec.ts` — careType inválido · open patientIds · child duplicado
