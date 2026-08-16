# Manual técnico — Vacinação (P5)

**Versão:** 0.6.0-dev  
**RF:** RF-14.1 / 14.2 / 14.7 / 14.8 / 14.11 / 14.14 / 14.15–16 / 14.19 (parciais) + RF-10.3 / RF-10.20 na produção  
**Fonte:** dicionário LEDI + seed versionado `vaccinations/seeds/` + design E1

## Endpoints

| Método | Path | Notas |
|---|---|---|
| GET | `/api/v1/catalog/vaccination` | 99 imunos LEDI + 54 faixas; `stock` = STOCK_MVP |
| POST | `/api/v1/catalog/vaccination/sync` | Overlay municipal → Prisma + memória (`reset` limpa overlay) |
| POST | `/api/v1/catalog/vaccination/seed` | Force re-seed tabelas (`source=seed`) |
| GET | `/api/v1/vaccination-stock?facilityId=` | Lotes de estoque ativos |
| POST | `/api/v1/vaccination-stock` | Entrada (soma qty se lote já existir) |
| POST | `/api/v1/vaccinations` | Aplica + lote LEDI `ready` + **baixa estoque se lote existir** |
| GET | `/api/v1/vaccinations?patientId=` | Lista |
| GET | `/api/v1/vaccinations/:id` | Detalhe |
| POST | `/api/v1/vaccinations/:id/void` | VOID local + **estorno qty** se houve baixa |
| GET | `/api/v1/patients/:id/vaccination-card` | Cartão JSON |
| GET | `/api/v1/patients/:id/vaccination-card.pdf` | PDF |

## Estoque / frio MVP

- Modelo: `VaccinationStockLot` (lote, validade, qty, unit=`dose`, `targetTempMinC`/`MaxC`, `roomLabel`)
- Movimentos: `ENTRY` | `APPLY` | `VOID_RETURN`
- Match baixa: `facilityId` + `immunobiologicalId` + `lot` (trim)
- Sem estoque do lote → aplicação **não** bloqueia
- Estoque qty&lt;1 → `400` insuficiente
- **Não inclui:** monitoramento contínuo de geladeira (IoT), alarmes, equipamentos frios, caixa térmica, almoxarifado

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
- Tabelas: `vaccination_immunobiologicals`, `vaccination_age_ranges`, `vaccination_stock_lots`, `vaccination_stock_movements`

## Faturamento

`POST /vaccinations` cria `production_batches` com `kind=vaccination` e payload LEDI-ready (ids numéricos estáveis, ex. BCG=15). Baixa de estoque **não** altera o payload LEDI.
