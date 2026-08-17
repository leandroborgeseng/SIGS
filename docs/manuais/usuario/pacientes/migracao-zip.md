---
id: pacientes.migracao-zip
title: Migração ZIP → Paciente Mestre
type: user
module: pacientes
feature: migracao-zip
version: 0.2.0
product_min: 0.1.0
status: published
audience: [ti, faturamento, gestor]
related_rf: [RF-2.1, RF-9.1]
related_screens: [/pacientes/migracao, /faturamento/auditoria]
updated_at: 2026-08-17
---

# Migração ZIP → Paciente Mestre — usuário

1. Abra **Pacientes → Migração ZIP** (`/pacientes/migracao`).
2. Selecione um ZIP LEDI (fichas XML do e-SUS / gerador).
3. **Dry-run (padrão):** deixe “Persistir” desmarcado. O sistema conta findings por código sem gravar e sem exibir PHI.
4. **Persistir:** marque a opção só quando quiser criar/vincular pacientes no Paciente Mestre e gravar `ProductionRecord`.
5. Use o relatório `byCode` para priorizar correções (ex.: `ST_NAO_POSSUI_CPF`, `PROC_CODE_ABPG`, P×2).

CLI: `npm run migrate:ledi-zip -- --file=lote.zip` (adicione `--persist` para gravar).

Não substitui o wizard de lotes em `/faturamento/lote/…`. Serve para popular o mestre e reduzir findings `*_CNS_NOT_IN_CADASTRO_INDIVIDUAL` na auditoria.
