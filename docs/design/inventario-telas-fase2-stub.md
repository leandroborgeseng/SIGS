# Inventário / prompt stub — Claude Design (Fase 2 UI)

**Data:** 2026-08-16  
**Escopo:** só inventário + ganchos de prompt. **Sem** UI nova completa nesta fase.

## Já entregue (não redesenhar do zero)

| Área | Rota atual | Entrega design existente |
|---|---|---|
| Shell / marca Franca | AppShell | `entregas/2026-08-10-claude-design-mvp/` |
| Lotes LEDI FAI/FAO/PROC | `/faturamento/lote/*` | wizard shell reutilizável na Fase 2 |
| APS / Odonto / Vacina | `/aps` `/odonto` `/vacinacao` | FieldHint Siaps/Previne nas fichas |

## Prioridade Fase 2 (conectar à entrega Claude Design)

1. Hub faturamento + filas + auditoria (`/faturamento`, `/faturamento/auditoria`)
2. Cadastros CNES municipal + PF (`/cadastros/cnes-auditoria`, `/unidades`, `/lotacoes`)
3. Território / visita ACS (`/territorio`)
4. Agenda grade APS/Odonto (`/aps/agenda`, `/odonto/agenda`) — salas municipais ainda stub

## Prompt mínimo para Claude Design (colar + anexar STATUS)

```
Contexto: SIGS Prefeitura de Franca — Fase 2 só UI.
API Nest já cobre CNES gestao=municipal (natureza 1244), PF lotados,
auditoria faturamento, APS/odonto/vacina/LEDI.
Não inventar SAMU/LIS/TFD. Sem PHI.
Reutilizar shell e tokens da entrega 2026-08-10-claude-design-mvp.
Priorizar: faturamento hub/auditoria → cadastros CNES/PF → território → agenda salas.
```

## Fora de escopo agora

- SAMU · LIS · TFD · Farmácia geral · Hospitalar
- Redesign do wizard LEDI (só skin na Fase 2)
