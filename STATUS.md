# STATUS — SIGS

- **etapa_atual:** Import CNES Franca (estabelecimentos + equipes); próximo gap técnico abaixo
- **entregue (A–F + odontograma + agenda grade + RF-12.13 + RF-12.11 + APS FAI + fila APS + LEDI P1 + wizard lote + Ondas domingo 2026-08-16 + frio/almox + visita ACS + CNES sync):**
  - Área `/faturamento` (hub · filas `/faturamento/odonto` e `/faturamento/aps` · sanfona **Tratamento de lotes LEDI**: FAO / FAI / Procedimentos)
  - **APS FAI Onda A:** `/aps/[id]` com SOAP + antropometria → mapper · RF-3.24/3.55 parciais
  - **Vacinação:** catálogo LEDI **v3 (99 imunos)** + 54 faixas · void · PDF · UI `/vacinacao` · **estoque/frio beyond-MVP**
  - **RF-2.30 / RF-2.29 / RF-17.11–17.12 / RF-3.54** — CDS, domicílio, visita ACS, AD multi-child (intactos)
  - **CNES Franca (IBGE 3516200):** sync idempotente estabelecimentos + equipes · snapshot `data/cnes/franca-3516200.json` · `POST /v1/cnes/sync` · `GET /v1/cnes/audit` · `npm run sync:cnes` · UI `/unidades` + `/cadastros/cnes-auditoria`
- **como usar:**
  1. `/aps/agenda` ou `/aps` → ficha FAI → fila `/faturamento/aps`
  2. `/vacinacao` — aplicar · estoque/frio · anular · cartão PDF
  3. `/territorio` — microáreas · domicílios · visitas ACS
  4. `/unidades` — Sync CNES Franca · listar unidades/equipes importadas
  5. `npm run sync:cnes -- --ibge=3516200 --source=snapshot` (offline) ou `source=auto` (live→fallback)
  6. `/ad` · `/coletivo` · `/odonto/[id]` · lotes `/faturamento/lote/{fai,fao,proc}`
- **API:** + `POST /v1/cnes/sync` · `GET /v1/cnes/snapshot` · facilities com `_count.teams` e filtro `ibge`/`active`
- **params:** `MUNICIPIO_IBGE` · `CNES_DATA_DIR` · `CNES_API_BASE` · `CNESWEB_BASE`
- **limite documentado:** sync CNES **sem** profissionais lotados (PF); demais limites APS anteriores
- **próximo:** ver **Retomar daqui — domingo 16/08/2026**

## Retomar daqui — domingo 16/08/2026

### Commits / ondas do dia (confirmados `git log`)

| Commit | Onda |
|--------|------|
| `6d3087d` | FAI SOAP/medições · vacina LEDI numérica/PDF · coletivo · AD |
| `7699d72` | Vacina catálogo/faixa/void · cadastro individual RF-2.30 |
| `a4ba05c` | Domicílio/família CDS territorial (RF-2.29) |
| `a938f16` | AD multi-child LEDI (RF-3.54) · condições · qty BPA |
| `00e180f` | Catálogo 99 imunobiológicos LEDI v3 + faixas Prisma |
| `3a44631` | Estoque/frio vacinal MVP |
| `b2928ca` | Frio/almox beyond-MVP |
| `760a436` | Visita ACS lat/long MVP (RF-17.11/17.12) |
| *(pendente push)* | Import CNES Franca estabelecimentos+equipes |

### Já fechado (não reabrir nesta fase)
- Wizard lote LEDI FAI / FAO / PROC — não quebrar
- Estoque/frio + visita ACS lat/long — não reabrir como MVP stub
- Import CNES unidades/equipes Franca — não reabrir como stub (próximo = PF/lotações)

### Pendente / próximos gaps
1. Import CNES **profissionais lotados** (PF → `Professional` + `ProfessionalAssignment`)
2. Import dump real `TB_FAIXA_ETARIA_VACINACAO` quando disponível
3. Lote XML cadastro domiciliar e visita ACS (tipo 8) / AD
4. Polish gaps RF APS ainda parciais
5. Fase 2 UI Claude Design — **não** nesta fase
6. Fora APS P0: SAMU · Farmácia geral · Hospitalar

### Notas handoff
- Working tree: não commitar `data/esus`, `data/sigtap`, `sus_intelligence`, `tools/*-home`, `contexts/`
- **Sim** versionar `data/cnes/*.json` (sem PHI)
- Sem dados reais de pacientes
- Não quebrar wizard lote FAI/FAO/PROC
- Após pull: `cd apps/api && npx prisma db push` (endereço Facility + unique cnes/ine + tabelas anteriores)

_Atualizado em 2026-08-16 (onda import CNES Franca)_
