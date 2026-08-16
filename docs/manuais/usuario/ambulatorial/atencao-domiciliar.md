---
id: ad.stub
title: Atenção domiciliar
type: user
module: ambulatorial
feature: home-care
version: 0.4.0
product_min: 0.2.0
status: stub
audience: [profissional, gestor]
related_rf: [RF-3.54]
related_screens: [/ad]
updated_at: 2026-08-16
authors: [SIGS]
---

# Manual do usuário — Atenção domiciliar

**Tela:** `/ad` · **RF-3.54** · mapper `ledi-homecare-v2`  
**Convenção:** `docs/manuais/campos-siaps-previne.md` · ajuda: `ad.stub`

1. Marque um ou mais cidadãos (mesma ficha LEDI, até 99).
2. Escolha modalidade AD1/AD2/AD3, turno, tipo (programado / não programado / pós-óbito), local, procedimento e condições avaliadas.
3. Informe **CIAP e/ou CID-10** (busca) e o desfecho previsto — enviados no finish.
4. **Registrar ficha AD** → opcionalmente **+ cidadão** → **Preflight** (avisos sem gravar lote) → **Finalizar** → lote `home_care` em Produção (quantidade BPA = nº de cidadãos).

## Campos Siaps × Previne (UI)

| Campo na tela | Tom | Motivo (preflight) |
|---|---|---|
| Cidadãos (≥1, ≤99) | **Siaps** | `AD_CHILD_MISSING` / `AD_CHILD_OVERFLOW` |
| Modalidade AD1/AD2/AD3 | **Siaps** | `AD_MODALITY_MISSING` |
| Procedimento SIGTAP | **Siaps** | Produção / BPA |
| Turno / tipo atendimento / desfecho | **Indicador** | QUALITY_WARN se ausente |
| CIAP / CID | **Indicador** | QUALITY_WARN (qualidade clínica; não BLOCKER sozinho nesta ficha) |

UI Claude Design na fase 2. Lote XML AD / visita ACS tipo 8 permanece adiado.
