---
id: faturamento.lote-cds
title: Lotes LEDI CDS 2/3/6/7/8/10 — wizard técnico
type: technical
module: faturamento
feature: lote-cds
version: 0.2.0
product_min: 0.2.0
status: draft
audience: [ti, desenvolvedor]
related_rf: [RF-10.3, RF-2.29, RF-2.30, RF-3.54, RF-17.11]
related_screens:
  [
    /faturamento/lote/cadastro-individual,
    /faturamento/lote/domicilio,
    /faturamento/lote/coletivo,
    /faturamento/lote/proc,
    /faturamento/lote/visita-acs,
    /faturamento/lote/ad,
  ]
updated_at: 2026-08-16
authors: [SIGS]
---

# Manual técnico — wizard lote CDS (2 / 3 / 6 / 7 / 8 / 10)

**Fonte de códigos:** `TipoDadoTranspEnum` (cds.common.api 5.5.24).  
**Desenho:** `docs/planejamento/desenho-lote-ledi-cds-3-8-10.md` (atualizado: stubs → live sintético).  
**Fluxo UI:** `docs/planejamento/fluxo-lote-ledi-wizard.md` (mesmo shell `LediTipoLotePage`).

## O que está live

| Código | Rota | Schema |
|---:|---|---|
| 2 | `/faturamento/lote/cadastro-individual` | sintético (sem dump Franca) |
| 3 | `/faturamento/lote/domicilio` | sintético |
| 4 | `/faturamento/lote/fai` | dump Franca |
| 5 | `/faturamento/lote/fao` | dump Franca |
| 6 | `/faturamento/lote/coletivo` | sintético |
| 7 | `/faturamento/lote/proc` | dump Franca |
| 8 | `/faturamento/lote/visita-acs` | sintético |
| 10 | `/faturamento/lote/ad` | sintético |
| 14 | stub `/vacinacao` | fora desta onda |

## Críticas / autofix

- Header: UUID, `tpCdsOrigem`, CNS profissional, CBO, CNES 7 dígitos, IBGE, INE, data.
- Identidade: `stNaoPossuiCpf`, CNS/CPF (mesmo padrão FAI/PROC).
- Cruzamento municipal (se sync CNES/PF): `CNES_NOT_IN_MUNICIPAL_NETWORK`, `CNS_NOT_IN_MUNICIPAL_CNES`, `INE_NOT_IN_CNES_TEAM`.
- Autofix seguro: `stNaoPossuiCpf`, CNES/IBGE/tpCdsOrigem/UUID case, INE com input.

## Limitações honestas

- Dump Franca 5974691 **não** trouxe XMLs 2/3/6/8/10 — regras e fixtures são sintéticas a partir de enum/tags Transport.
- BLOCKER clínico específico de cada tipo CDS (além de header/identidade) permanece mínimo até amostra municipal.
- Vacina (14) não tem wizard ZIP nesta onda.

## Testar upload

1. Sincronizar rede municipal (`/cadastros/cnes-auditoria`) para cruzamentos.
2. Abrir `/faturamento/lote/visita-acs` (ou outro tipo).
3. ZIP homogêneo do tipo da tela → análise + autofix + export aptos/pendentes.
4. ZIP FAI na tela visita → `LEDI_TIPO_MISMATCH` (gate; sem lote).

```bash
cd apps/api && npx jest --testPathPattern='ledi-cds-extra|ledi-ficha-tipo|ledi-cds-lote'
npm run smoke:cnes-pf-ledi
```

Fixtures: `apps/api/src/care-extra/fixtures/ledi-cds-synthetic.ts`.
