# Manual técnico — IBGE na unidade (header LEDI)

**Versão:** 0.1.0-dev  
**RF:** RF-2.47, RF-10.3 / RF-10.20

## Modelo

`Facility.ibgeCode` (7 dígitos) → `headerTransport.codigoIbgeMunicipio` em todos os mappers LEDI v2.

Fallback: env `SIGS_IBGE_MUNICIPIO`.

## API

| Método | Path |
|---|---|
| GET | `/v1/facilities` |
| PATCH | `/v1/facilities/:id` `{ ibgeCode, name?, … }` |

Validação: exatamente 7 dígitos (aceita máscara e normaliza).

## Demo

UBS demo usa **3516200** (Franca/SP). Seed atualiza bases antigas sem IBGE.

Import em massa: ver [cnes-import.md](./cnes-import.md) (`npm run sync:cnes` / `POST /v1/cnes/sync`).

## Preflight

`IBGE_MISSING` / `IBGE_FORMAT` → `MONEY_RISK` + checklist `ibge_ok`.
