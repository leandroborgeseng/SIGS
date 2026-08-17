# Manual técnico — Equipes CNES (membros e multi-equipe)

**Versão:** 0.1.0-dev  
**RF:** RF-2.19, RF-2.28 (parcial), RF-2.61  
**Escopo:** rede municipal Franca (natureza 1244 / CNPJ mantenedora `47970769000104`)

## APIs

| Método | Rota | Uso |
|---|---|---|
| `GET` | `/v1/cnes/team-types` | Catálogo de tipo de equipe (labels) |
| `GET` | `/v1/cnes/teams?ibge=3516200&gestao=municipal` | Lista equipes com `teamTypeLabel`, `memberCount`, unidade |
| `GET` | `/v1/cnes/teams/:id` | Detalhe + membros (nome, CNS, CBO + label, vínculo) |
| `GET` | `/v1/cnes/multi-team?gestao=municipal` | Profissionais com lotação ativa em **mais de uma** equipe |
| `GET` | `/v1/cnes/network-export?gestao=municipal` | CSV unidades × equipes × PF |

Filtros lista: `q`, `teamTypeId`, `facilityId`, `activeOnly` (default true).

Finding de auditoria opcional: `TEAM_WITHOUT_MEMBERS` (equipe ativa sem lotação PF).

## Catálogo de tipo (mínimo Franca)

Fonte: `teamTypeLabel` do snapshot `data/cnes/franca-3516200.json`. Código desconhecido → `Tipo N (sem catálogo)`.

| Código | Label |
|---|---|
| 22 | EMAD I — Equipe Multiprofissional de Atenção Domiciliar I |
| 23 | EMAP — Equipe Multidisciplinar de Apoio |
| 70 | ESF — Equipe de Saúde da Família |
| 71 | ESB — Equipe de Saúde Bucal |
| 72 | eMulti — Equipe Multiprofissional na Atenção Primária à Saúde |
| 73 | eCR — Equipe dos Consultórios na Rua |
| 74 | eAPP — Equipe de Atenção Primária Prisional |
| **76** | **EAP — Equipe de Atenção Primária** |

Implementação: `apps/api/src/cnes/team-type-catalog.ts`.

## Pré-requisitos

1. `POST /v1/cnes/sync?gestao=municipal` (unidades + equipes)
2. `POST /v1/cnes/sync-professionals` (PF → `Professional` + `ProfessionalAssignment`)

## UI

- `/equipes` — lista filtrável + aba Multi-equipe + export CSV
- `/equipes/[id]` — membros da equipe
- Deep-link: auditoria CNES aba equipes → «Ver todas as equipes e membros»
- Lotações: CNS/INE/badge CNES + CTA sync PF

```bash
cd apps/api && npx jest src/cnes/team-type-catalog.spec.ts src/cnes/cnes-teams.service.spec.ts src/cnes/cnes-audit.service.spec.ts
npm run smoke:cnes-pf-ledi
```
