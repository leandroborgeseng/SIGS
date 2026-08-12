# Checklist — piloto UBS (demo)

Objetivo: validar o fluxo APS → produção → BPA/SIGTAP em uma unidade de demonstração, **sem dados reais de pacientes**.

**Execução automática (API):** 2026-08-10 · UBS Centro Demonstração · resultado: **PASS completo** (APS + vacina + odonto + AD + coletivo)

## Pré-requisitos

- [x] Schema + `npm run dev` + login admin
- [x] Unidade: UBS Centro Demonstração

## Fluxo clínico mínimo

- [x] Pacientes demo Maria/João
- [x] APS + reuso de fila (`reused: true`)
- [x] Vacina
- [x] Odonto → `dental_encounter` · `0101020010`
- [x] **AD** → `home_care` AD2 · `0101040024` · SIGTAP known
- [x] Coletivo

## Produção + SIGTAP

- [x] Export BPA com linhas de todos os kinds exercitados
- [x] SIGTAP known para odonto e AD

## Aceite

- [x] Sem dados reais
- [x] Auditoria (open/finish AD, export_bpa)
- [x] Gaps: SIGTAP MS **TB_PROCEDIMENTO** via `import-ms` (zip completo / relacionamentos CBO ficam para depois); odontograma completo fica para depois

_Atualizado em 2026-08-10_
