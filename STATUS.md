# STATUS — SIGS

- **etapa_atual:** Domingo APS — **CNES municipal + PF lotados** fechados; próximo polish/agenda stub ou inventário design
- **entregue (A–F + odontograma + agenda grade + RF-12.13 + RF-12.11 + APS FAI + fila APS + LEDI P1 + wizard lote + Ondas domingo 2026-08-16 + frio/almox + visita ACS + AD polish + CNES municipal + PF + auditoria faturamento):**
  - Área `/faturamento` (hub · filas · lotes LEDI · **`/faturamento/auditoria`**)
  - **APS FAI Onda A:** `/aps/[id]` com SOAP + antropometria → mapper · RF-3.24/3.55 parciais
  - **Vacinação:** catálogo LEDI **v3 (99 imunos)** + 54 faixas · void · PDF · UI `/vacinacao` · **estoque/frio beyond-MVP**
  - **RF-2.30 / RF-2.29 / RF-17.11–12 / RF-3.54** (CDS · domicílio · visita ACS · AD)
  - **CNES (RF-10.2 / RF-9.6 / RF-2.2):** snapshot cidade + **filtro `gestao=municipal`** (natureza **1244** → 66 est. / 123 eq.) · **PF** `franca-3516200-professionals.json` (503 prof / 742 lot) · `POST /v1/cnes/sync-professionals` · UI sync + import PF · auditoria faturamento `CNS_NOT_IN_MUNICIPAL_CNES`
  - **Auditoria faturamento (RF-10.21):** `GET /v1/faturamento/audit?competencia=&ibge=3516200&gestao=municipal`
- **como usar:**
  1. **Sincronizar rede municipal** em `/cadastros/cnes-auditoria` ou `/unidades`
  2. **Importar profissionais lotados** (mesmo tela) — ou `npm run sync:cnes -- --professionals`
  3. `/cadastros/cnes-auditoria` · `/faturamento/auditoria?competencia=YYYY-MM`
  4. API: `POST /v1/cnes/sync?gestao=municipal` · `POST /v1/cnes/sync-professionals` · `GET /v1/cnes/audit` · `GET /v1/faturamento/audit`
  5. Fluxos APS/odonto/vacina/territorio/AD/lotes LEDI (inalterados)
- **params:** `MUNICIPIO_IBGE` · `CNES_SNAPSHOT_PATH` · `CNES_PROFESSIONALS_SNAPSHOT_PATH` · `CNES_SYNC_ON_BOOT` · `CNES_SYNC_PROFESSIONALS_ON_BOOT` · `CNES_SYNC_GESTAO` · …
- **limite documentado:** PF só equipes CnesWeb (sem CPF); live depende de rede; wizard LEDI intacto
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
| `760a436` | Visita ACS lat/long MVP |
| `8b3de08` | AD CIAP/CID UI + preview |
| `d1736e4` | CNES sync Franca + auditoria cadastro |
| `8a02ba1` | Auditoria de faturamento ficha×cadastros |
| `07d72eb` | CNES **só rede municipal** (natureza 1244) |
| `(pendente)` | Import **profissionais lotados** PF + audit CNS municipal |

### Já fechado (não reabrir nesta fase)
- Wizard lote LEDI FAI / FAO / PROC
- Estoque/frio · Visita ACS · Agenda CONSULTA/ENCAIXE · AD CIAP/CID
- **CNES sync + filtro Prefeitura + PF lotados** — não reabrir como stub
- **Auditoria de faturamento** (estendida com PF)

### Pendente / próximos gaps
1. Import dump real `TB_FAIXA_ETARIA_VACINACAO` quando disponível
2. Lote XML cadastro domiciliar / visita ACS / AD — bloqueado até dump/TB
3. Agenda TR residual (salas / grade municipal) — só se TR exigir
4. Fase 2 UI Claude Design — inventário/prompt ok; UI completa não nesta fase
5. Fora APS P0: SAMU · Farmácia geral · Hospitalar

### Notas handoff
- Não commitar `data/esus`, `data/sigtap`, `sus_intelligence`, `tools/*-home`, `contexts/`
- **Commitar** `data/cnes/*.json` (público)
- Sem dados reais de pacientes (PF = cadastro público CNES: nome+CNS+CBO)
- Critério municipal: **natureza jurídica 1244**
- Ordem sync: unidades/equipes **antes** de profissionais

_Atualizado em 2026-08-16 (CNES municipal + PF lotados)_
