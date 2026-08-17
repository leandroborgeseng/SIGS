# STATUS — SIGS

- **etapa_atual:** Domingo APS — **Ajuda regras internas LEDI** (funil · por tipo · cruzamentos · Siaps×Previne) + wizard CDS 2/3/6/7/8/10 live
- **entregue (A–F + odontograma + agenda + APS/FAO/PROC + CNES/PF + auditoria + FieldHint + wizard CDS + ajuda regras):**
  - Central de Ajuda — artigos `faturamento.funil-pre-envio` · `regras-por-tipo` · `cruzamentos` · `siaps-vs-previne` (todos os usuários)
  - Hub `/faturamento` + lotes: atalhos para esses artigos
  - Área `/faturamento` — lotes LEDI **live** tipos **2, 3, 4, 5, 6, 7, 8, 10** (mesmo shell `LediTipoLotePage` · gate · autofix · 2 ZIPs)
  - Tipos **2/3/6/8/10**: schema sintético (dump Franca só 4/5/7) — fixtures + RulePack CDS + cruzamento municipal CNES/PF/INE
  - Tipo **7** reforçado (mesmo funil; sem regressão)
  - Vacina **14** = stub (fora desta onda)
  - Catálogo `GET /v1/faturamento/ledi-cds-lotes`
  - CNES municipal · PF · `/equipes` · auditoria faturamento · FieldHint
- **como usar:**
  1. Sync rede municipal em `/cadastros/cnes-auditoria` (cruzamentos no lote)
  2. Hub `/faturamento` → **Regras internas (ajuda)** ou escolher tipo → upload ZIP homogêneo
  3. Gate recusa tipo errado (`LEDI_TIPO_MISMATCH`)
  4. Autofix seguro (`stNaoPossuiCpf`, CNES/IBGE/tpCdsOrigem…) → export aptos / pendentes
  5. Smoke: `npm run smoke:cnes-pf-ledi`
- **limite documentado:** 2/3/6/8/10 sem XML real no dump — regras header/identidade + mínimas por tipo; calibrar BLOCKER clínico com amostra municipal; vacina 14 sem lote ZIP; wizard 4/5/7 não regredido
- **próximo:** amostra municipal CDS · TB_FAIXA vacina · deep-link audit→ficha · Previne B1–B6 painel

## Retomar daqui — domingo 16/08/2026 (noite)

**Ajuda regras:** `/ajuda?artigo=faturamento.funil-pre-envio` · manuais `docs/manuais/usuario/faturamento/{funil-pre-envio,regras-por-tipo,cruzamentos,siaps-vs-previne}.md`

**Wizard CDS:** [docs/planejamento/desenho-lote-ledi-cds-3-8-10.md](docs/planejamento/desenho-lote-ledi-cds-3-8-10.md) · [docs/manuais/tecnico/faturamento/lote-cds-wizard.md](docs/manuais/tecnico/faturamento/lote-cds-wizard.md)

### Como testar upload
1. `/faturamento/lote/visita-acs` (ou cadastro-individual / domicilio / coletivo / ad / proc)
2. ZIP só com XMLs daquele `tipoDadoSerializado`
3. Análise → corrigir em lote → baixar `…-aptos-envio.zip` e `…-pendentes.zip`
4. Fixture API: `apps/api/src/care-extra/fixtures/ledi-cds-synthetic.ts`

### Já fechado (não reabrir)
- Wizard 4/5/7 (mantido)
- CNES/PF / equipes / auditoria
- Stubs CDS → **substituídos** por wizard live sintético
- Ajuda regras internas no hub + lotes

### Pendente
1. Dump `TB_FAIXA_ETARIA_VACINACAO` + lote vacina 14
2. Calibrar regras CDS com ZIP municipal real
3. Claude Design fase 2 · SAMU/LIS/TFD fora

### Notas handoff
- Não commitar `data/esus`, `data/sigtap`, `sus_intelligence`, `tools/*-home`, `contexts/`
- Sem dados reais de pacientes
