# Manual técnico — Vacinação (P5)

**Versão:** 0.4.0-dev  
**RF:** RF-14.1 (Obr.) + RF-10.3 / RF-10.20 na produção  
**Fonte:** `spec/vaccination` + LEDI vacinação + design E1

## Endpoints

| Método | Path | Notas |
|---|---|---|
| GET | `/api/v1/catalog/vaccination` | Seed imuno/estratégia/dose/via/local |
| POST | `/api/v1/vaccinations` | Aplica + gera lote LEDI `ready` |
| GET | `/api/v1/vaccinations?patientId=` | Lista |
| GET | `/api/v1/vaccinations/:id` | Detalhe |
| GET | `/api/v1/patients/:id/vaccination-card` | Cartão simples |

## Cascata / regras (backend)

1. Imunobiológico → Estratégia → Dose → Lote/Fabricante/Via/Local  
2. `strategyId=SPECIAL` ⇒ `prescriberCbo` + `indicationCid10` obrigatórios  
3. `immunobiologicalId=BCG` ⇒ `leprosyContact` boolean obrigatório  
4. `RESEARCH` / `isClinicalResearch` ⇒ campos ANVISA  
5. Lote: charset alfanumérico, máx. 30  

## Faturamento

`POST /vaccinations` cria `production_batches` com `kind=vaccination` e payload LEDI-ready.
