# Arquitetura — núcleo FHIR-like, motor único, Paciente Mestre

**Decisão:** 2026-08-12 (instrução de produto)  
**Status:** ativa — alicerce em implementação  
**Stack:** NestJS + Prisma + Next.js (`docs/planejamento/stack-oficial.md`)

## Por quê

Hoje a entrada dominante é **XML LEDI do e-SUS APS** (FAO/FAI/PROC). O destino de faturamento/produção é **Siaps → RNDS**. Se o domínio interno for “XML e-SUS”, trocar o exportador RNDS vira reescrita. Se for **recurso interno FHIR-like**, LEDI e RNDS são só **adaptadores**.

Objetivos:

1. Desacoplar o legado (ler XML, **não** escrever no banco e-SUS).  
2. Preparar RNDS (exportador pluggable).  
3. Base coesa (um paciente, muitos identificadores, histórico migrado).

---

## Os cinco pilares

### 1. Modelo interno FHIR-like

| Conceito interno | Análogo FHIR (orientação) | Origem típica hoje |
|---|---|---|
| `SigsPatient` | `Patient` | cadastro + extrato de ficha |
| `SigsEncounter` | `Encounter` | atendimento FAO/FAI/PROC |
| `SigsComposition` / `SigsProductionRecord` | `Composition` / Bundle entry | ficha master + uuidFicha |
| `SigsPractitioner` / `SigsOrganization` | `Practitioner` / `Organization` | lotação / CNES |
| `SigsProcedure` / `SigsCondition` | `Procedure` / `Condition` | SIGTAP / CIAP-CID |

**Regra:** nenhum módulo de negócio depende de tags XML.  
Fluxo:

```text
  XML e-SUS / módulo novo / API
           │
           ▼
   ┌───────────────────┐
   │  Importer/Adapter │  (LEDI XML → Sigs*)
   └─────────┬─────────┘
             ▼
   ┌───────────────────┐
   │  Domínio Sigs*    │  (persistido / em memória)
   └─────────┬─────────┘
             ▼
   ┌───────────────────┐
   │  Exporter         │  LEDI XML | Bundle RNDS | BPA stub
   └───────────────────┘
```

Bundle FHIR **RIA** de entrada continua rejeitado no lote odonto (`FORMAT_FHIR_NOT_FAO`) — isso é **formato de transport legado errado**, não o modelo interno.

### 2. Motor de regras único

Tudo que entra passa pelo **mesmo pipeline**:

```text
ingest → normalize(FHIR-like) → validate → repair(suggest|apply)
       → audit → indicators(Previne/qualidade) → persist → export?
```

- Validadores LEDI atuais (`ledi-fao.validator`, FAI, PROC, Previne x-ray) viram **plugins** do motor (`RulePack`).  
- Registry P0 (`ledi-error-registry`) continua a fonte de códigos/caminhos A–E.  
- Correção, auditoria e indicadores **não** são cópias por tela — a UI só orquestra.

### 3. Paciente Mestre + identificadores

`Patient` (já existe) = **pessoa mestra**.  
CPF/CNS nas colunas atuais = **atalhos denormalizados** (compat UI); a fonte de verdade de IDs passa a ser:

**`PatientIdentifier`**

| Campo | Uso |
|---|---|
| `system` | `cpf` · `cns` · `uuid_ficha_cidadao` · `prontuario_local` · `tmp_ledi` · … |
| `value` | valor normalizado |
| `use` | `official` · `secondary` · `temp` · `old` |
| `patientId` | FK mestra |
| `source` | `cadastro` · `ledi_xml` · `merge` · `manual` |
| `verifiedAt` | opcional |

Um paciente pode ter **N** identificadores; unificação não apaga histórico — relink + `supersededBy`.

### 4. Unificação com níveis de confiança

| Nível | Ação |
|---|---|
| **HIGH** | unifica automático (mesmo CPF válido, ou CNS+DN+nome forte) |
| **MEDIUM** | fila de revisão (`PatientMatchCandidate` status=`pending_review`) |
| **LOW** | só sinaliza (candidato registrado, sem merge) |

Regras iniciais (ajustáveis; sem LGPD/dados reais em fixture):

- HIGH: CPF válido idêntico **ou** CNS válido idêntico.  
- MEDIUM: CNS parcial + DN + similaridade de nome ≥ limiar **ou** CPF inválido mas DN+mãe+nome.  
- LOW: só nome+DN sem ID; ou conflitos (mesmo CPF, DN diferente).

Toda unificação automática gera **evento de auditoria** (quem/quando/score/evidências).

### 5. XMLs históricos = migração (não mexer no legado)

```text
ZIP/XML histórico
  → Importer LEDI
  → Motor (validate/repair)
  → Resolve/cria Paciente Mestre + identifiers
  → Persiste Encounter/Production no Prisma SIGS
  → Relatório de migração (aceitos / corrigidos / rejeitados / revisão)
```

- **Zero escrita** no banco e-SUS.  
- Lotes atuais (`LediFaoBatch`) evoluem para *staging* desse pipeline.  
- Sem PII real em testes — fixtures sintéticas / hashes em samples públicos do repo.

---

## Relação com o plano LEDI 100%

| LEDI 100% | Este núcleo |
|---|---|
| P0 registry | RulePack codes |
| P1 campos ficha | repair no domínio Sigs* + reexport LEDI |
| P3 FAI/PROC | outros importers no mesmo motor |
| Export ZIP | Exporter LEDI (hoje) |
| Futuro RNDS | Exporter Bundle (depois) |

O lote `/odonto/lote` permanece a **UI de faturamento**; por baixo migra para o motor único.

---

## Fases de entrega

| Fase | Entrega | Status |
|---|---|---|
| **A0** | Doc + Prisma identifiers/match + types Sigs* + pipeline stub + adapter XML→Sigs | ✅ |
| **A3-lite** | Lote LEDI (`reportFromXml`) via `runRulesEngine` | ✅ |
| **A1** | Match HIGH merge real (FKs) + fila MEDIUM (`match-queue`) | ✅ |
| **A2** | `POST /migrate` → `ProductionRecord` + Paciente Mestre | ✅ |
| **A4** | Stub `POST /export/rnds` (contrato) | ✅ stub |
| **RF-12.13** | Catálogo SIGTAP predefinido no odontograma + `done` → FAO | ✅ |
| **RF-12.11** | Histórico de odontograma (mesmo paciente + unidade) | ✅ |
| **→** | Ficha APS origem (FAI tipo 4) + **LEDI P1** (campos individuais no motor) | próximo |

### Endpoints ` /v1/clinical-core`

| Método | Path | Uso |
|---|---|---|
| POST | `/normalize-ledi` | XML → Sigs* + findings |
| POST | `/migrate-dry-run` | migração só auditoria |
| POST | `/migrate` | migração persistida |
| POST | `/match` | propõe unificação (HIGH mergeia) |
| GET | `/match-queue` | fila MEDIUM |
| POST | `/match-queue/:id/resolve` | accept/reject |
| POST | `/export/rnds` | stub RNDS |

---

## Não-objetivos (por enquanto)

- Copiar schema/código e-SUS.  
- Enviar de verdade à RNDS em produção.  
- Resolver 100% de homônimos sem revisão humana.  
- Apagar CPF/CNS das colunas `patients` na A0 (migração gradual).

---

## Rastreabilidade TR

- RF cadastro paciente / listagem / prontuário (Anexo I § cadastros).  
- Interoperabilidade / RNDS (quando exportador A4).  
- Sem dados reais (princípio `06-principios-engenharia-reversa.md`).

## Referências de código (A0+)

- `apps/api/prisma/schema.prisma` — `PatientIdentifier`, `PatientMatchCandidate`
- `apps/api/src/clinical-core/` — tipos FHIR-like + `RulesEngine`
- `apps/api/src/clinical-core/adapters/ledi-xml.adapter.ts`
- `docs/rastreabilidade/cobertura-ledi-erros.md` — códigos do RulePack LEDI
