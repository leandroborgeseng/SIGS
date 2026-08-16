# Manual técnico — Vacinação (P5)

**Versão:** 0.7.0-dev  
**RF:** RF-14.1 / 14.2 / 14.4 / 14.6 / 14.7 / 14.8 / 14.11 / 14.14 / 14.15–19 (parciais) + RF-10.3 / RF-10.20 na produção  
**Fonte:** dicionário LEDI + seed versionado `vaccinations/seeds/` + design E1

## Endpoints

| Método | Path | Notas |
|---|---|---|
| GET | `/api/v1/catalog/vaccination` | 99 imunos LEDI + 54 faixas; `stock` = STOCK_MVP (`beyond-mvp`) |
| POST | `/api/v1/catalog/vaccination/sync` | Overlay municipal → Prisma + memória (`reset` limpa overlay) |
| POST | `/api/v1/catalog/vaccination/seed` | Force re-seed tabelas (`source=seed`) |
| GET | `/api/v1/vaccination-stock?facilityId=` | Lotes de estoque ativos (+ equipamento) |
| POST | `/api/v1/vaccination-stock` | Entrada (soma qty; opcional `coldEquipmentId`) |
| GET/POST | `/api/v1/vaccination-cold-equipment` | Equipamentos frios (RF-14.17) |
| PATCH | `/api/v1/vaccination-cold-equipment/:id` | Status/faixa/label |
| GET/POST | `/api/v1/vaccination-thermal-boxes` | Caixas térmicas (RF-14.18) |
| PATCH | `/api/v1/vaccination-thermal-boxes/:id` | Status / vínculo equipamento |
| GET/POST | `/api/v1/vaccination-temp-readings` | Leitura **manual** °C (RF-14.19; `withinRange`) |
| GET/POST | `/api/v1/vaccination-supplies` | Insumos leves (RF-14.4/14.6) |
| POST | `/api/v1/vaccination-supplies/:id/entry` | Entrada adicional de qty |
| GET/POST | `/api/v1/vaccination-supply-links` | Vínculo imuno → insumo (`qtyPerDose`) |
| POST | `/api/v1/vaccinations` | Aplica + lote LEDI + baixa estoque **e** insumos vinculados |
| GET | `/api/v1/vaccinations?patientId=` | Lista |
| GET | `/api/v1/vaccinations/:id` | Detalhe |
| POST | `/api/v1/vaccinations/:id/void` | VOID local + estorno qty estoque/insumos |
| GET | `/api/v1/patients/:id/vaccination-card` | Cartão JSON |
| GET | `/api/v1/patients/:id/vaccination-card.pdf` | PDF |

## Estoque / frio beyond-MVP

- Lote: `VaccinationStockLot` (+ `coldEquipmentId` opcional)
- Equipamento: `VaccinationColdEquipment` (`REFRIGERATOR` \| `FREEZER` \| `COLD_ROOM`)
- Caixa: `VaccinationThermalBox` (`AVAILABLE` \| `IN_USE` \| `MAINTENANCE`)
- Leitura: `VaccinationTempReading` — **manual**; calcula `withinRange` vs faixa alvo
- Insumos: `VaccinationSupply` + `VaccinationSupplyLink` + movimentos `ENTRY`/`APPLY`/`VOID_RETURN`
- Match baixa vacina: `facilityId` + `immunobiologicalId` + `lot`
- Match baixa insumo: links ativos do imuno na unidade; qty insuficiente → `400`
- Sem estoque do lote → aplicação **não** bloqueia; sem vínculos de insumo → no-op
- **Não inclui:** IoT contínuo, alarmes, farmácia municipal geral, transferência entre unidades

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
- Tabelas: `vaccination_immunobiologicals`, `vaccination_age_ranges`, `vaccination_stock_lots`, `vaccination_stock_movements`, `vaccination_cold_equipments`, `vaccination_thermal_boxes`, `vaccination_temp_readings`, `vaccination_supplies`, `vaccination_supply_links`, `vaccination_supply_movements`

## Faturamento

`POST /vaccinations` cria `production_batches` com `kind=vaccination` e payload LEDI-ready. Baixa de estoque/insumos **não** altera o payload LEDI.
