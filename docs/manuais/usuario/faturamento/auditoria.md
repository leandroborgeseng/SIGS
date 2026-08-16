---
id: faturamento.auditoria
title: Auditoria de faturamento
type: user
module: faturamento
feature: auditoria
version: 0.1.0
product_min: 0.2.0
status: stub
audience: [gestor, faturamento]
related_rf: [RF-10.21, RF-9.6, RF-10.2]
related_screens: [/faturamento/auditoria, /faturamento]
updated_at: 2026-08-16
authors: [SIGS]
---

# Auditoria de faturamento (stub)

**Tela:** `/faturamento/auditoria?competencia=YYYY-MM`  
**Ajuda in-app:** `faturamento.auditoria`

Cruza a produção da competência com a **rede municipal** CNES/INE e o snapshot de profissionais lotados (PF).

## Antes de auditar

1. Sincronize unidades/equipes municipais em `/cadastros/cnes-auditoria`.
2. Importe profissionais lotados (PF) na mesma tela.
3. Informe a competência (ex.: `2026-08`).

## Alertas úteis

| Código | Significado |
|---|---|
| `CNES_*` / `INE_*` | unidade/equipe fora do cadastro municipal |
| `CNS_NOT_IN_MUNICIPAL_CNES` | CNS da ficha não está no PF municipal (CnesWeb) |
| `CNS_NOT_LINKED` / `CBO_MISMATCH` | lotação SIGS incompleta ou CBO divergente |
| `SIGTAP_*` / `CIAP_*` / `CONDUTA_MISSING` | catálogo ou campos Siaps da ficha |

Não altera o wizard LEDI. Detalhe técnico: `docs/manuais/tecnico/faturamento/auditoria-faturamento.md`.
