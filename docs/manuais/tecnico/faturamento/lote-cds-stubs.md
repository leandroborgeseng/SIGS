---
id: faturamento.lote-cds-stub
title: Lotes LEDI CDS 3/8/10 — stub técnico
type: technical
module: faturamento
feature: lote-cds-stub
version: 0.1.0
product_min: 0.2.0
status: stub
audience: [ti, desenvolvedor]
related_rf: [RF-10.3, RF-2.29, RF-3.54]
related_screens:
  [
    /faturamento/lote/domicilio,
    /faturamento/lote/visita-acs,
    /faturamento/lote/ad,
  ]
updated_at: 2026-08-16
authors: [SIGS]
---

# Manual técnico — stubs lote CDS 3 / 8 / 10

**Fonte de códigos:** `TipoDadoTranspEnum` (cds.common.api 5.5.24).  
**Desenho:** `docs/planejamento/desenho-lote-ledi-cds-3-8-10.md`.

## API / domínio

| Peça | Caminho |
|---|---|
| Catálogo live×stub | `GET /v1/faturamento/ledi-cds-lotes` → `ledi-cds-lote.stub.ts` |
| Detector + gate | `ledi-ficha-tipo.ts` (`detectLediFichaTipo`, `assertLoteTipoMatch`, `CDS_LOTE_STUB`) |
| UI stub | `apps/web` rotas `/faturamento/lote/{domicilio,visita-acs,ad}` |

## Contratos de regressão

- Live ZIP: tipos **4 / 5 / 7** (`loteXmlLive=true`).
- Stub: **3 / 8 / 10** (`loteXmlLive=false`); ZIP misto nas telas live → `LEDI_TIPO_MISMATCH` + `href` do stub.
- Vacina: código **14** (não 2).

## Desbloqueio wizard

Exige amostra XML municipal (ZIP ou ficha isolada) dos tipos 3, 8 e/ou 10. Até lá **não** implementar upload/validação nestas rotas.

## Testes

```bash
npm run smoke:cnes-pf-ledi
# ou
cd apps/api && npx jest --testPathPattern='ledi-ficha-tipo|ledi-cds-lote'
```
