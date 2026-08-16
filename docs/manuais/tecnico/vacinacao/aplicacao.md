# Manual técnico — Vacinação (P5)

**Versão:** 0.5.0-dev  
**RF:** RF-14.1 / 14.2 / 14.7 / 14.8 (Obr.) + RF-10.3 / RF-10.20 na produção  
**Fonte:** dicionário LEDI + seed versionado `vaccinations/seeds/` + design E1

## Endpoints

| Método | Path | Notas |
|---|---|---|
| GET | `/api/v1/catalog/vaccination` | 99 imunos LEDI + 54 faixas + doses/estratégias; `persisted` Prisma |
| POST | `/api/v1/catalog/vaccination/sync` | Overlay municipal → Prisma + memória (`reset` limpa overlay) |
| POST | `/api/v1/catalog/vaccination/seed` | Force re-seed tabelas (`source=seed`) |
| POST | `/api/v1/vaccinations` | Aplica + gera lote LEDI `ready` |
| GET | `/api/v1/vaccinations?patientId=` | Lista |
| GET | `/api/v1/vaccinations/:id` | Detalhe |
| POST | `/api/v1/vaccinations/:id/void` | VOID local |
| GET | `/api/v1/patients/:id/vaccination-card` | Cartão JSON |
| GET | `/api/v1/patients/:id/vaccination-card.pdf` | PDF |

## Cascata / regras (backend)

1. Imunobiológico → Estratégia → Dose → Lote/Fabricante/Via/Local  
2. `strategyId=SPECIAL` ⇒ `prescriberCbo` + `indicationCid10` obrigatórios  
3. `immunobiologicalId=BCG` ⇒ `leprosyContact` boolean obrigatório  
4. `RESEARCH` / `isClinicalResearch` ⇒ campos ANVISA  
5. Lote: charset alfanumérico, máx. 30  
6. Faixa etária: seed PNI (≠ dump TB e-SUS); bloqueio em `create`

## Catálogo

- Seed: `apps/api/src/vaccinations/seeds/tb-imunobiologico.ledi-v3.json` (99)
- Faixas: `…/tb-faixa-etaria-vacinacao.seed-v3.json` (54)
- Tabelas: `vaccination_immunobiologicals`, `vaccination_age_ranges`

## Faturamento

`POST /vaccinations` cria `production_batches` com `kind=vaccination` e payload LEDI-ready (ids numéricos estáveis, ex. BCG=15).
