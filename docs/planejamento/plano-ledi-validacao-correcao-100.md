# Plano — Validação e correção LEDI em 100% dos casos

**Status:** P0–P5 entregues (2026-08-12)  
**Atualizado:** 2026-08-12  
**Escopo:** lotes FAO (5) · FAI (4) · Procedimentos (7) — análise pré-Siaps/RNDS + Previne ESB  
**Meta de produto:** fechar o ciclo *upload → diagnóstico → correção → revalidação → ZIP exportável* com **cobertura total dos códigos conhecidos**, máxima automação segura e fluxo humano só onde o dado é único ou clínico.

---

## 1. Definição de “100%” (contrato)

“100% dos casos” **não** significa inventar CPF/CNS/UUID. Significa:

| Classe | Definição de pronto |
|---|---|
| **A — Auto seguro** | Um clique (ficha ou lote) remove o alerta; revalidação confirma |
| **B — Semi-auto com input** | UI pede 1 valor (INE, justificativa CPF, CIAP…) e aplica em lote |
| **C — Individual editável** | Campo na ficha (ou editor XML assistido) + salvar/revalidar |
| **D — Origem / reexport** | Guia claro + checklist; ficha marcada “não corrigível aqui”; fila de exclusão/reenvio |
| **E — Info / Previne** | Não bloqueia Siaps; tratado depois dos vermelhos/laranjas; ação opcional |

**DoD do lote:**  
`bloqueioEnvio = 0` **ou** cada bloqueio restante classificado D com ação registrada (reexport/excluir).  
ZIP só recomendado quando `readyForFinalSend` (ou override auditado).

---

## 2. Estado atual (baseline)

| Camada | FAO | FAI | PROC |
|---|---|---|---|
| Validador | completo-ish | subset | subset |
| Auto-fix API | 26 códigos | parcial (st CPF…) | parcial |
| UI guia + modal ficha | sim | **não** | **não** |
| Catálogo amigável | 72 códigos | herda FAO + 6 códigos órfãos | idem |
| Repair tipado | 59 / 72 | frágil | frágil |

**Gaps críticos hoje**

1. **13 códigos** no `ERROR_CATALOG` sem repair tipado (lookup sintetiza “individual/xml”).  
2. **6 códigos FAI/PROC** emitidos pela API fora do catálogo UI.  
3. **FAI/PROC** sem `ErrorGuideModal` / `FichaFixModal` (eficiência operacional baixa).  
4. Hard cases de identidade/tempo sem **editor assistido** (só “corrija na origem”).  
5. Sem **matriz viva** AUTO×código×teste×lote-amostra como gate de regressão.  
6. Scroll lock / UX de modais empilhados — já mitigado; falta hardening de fluxo (fechar guia ao abrir ficha ou ref-count — feito).

---

## 3. Arquitetura-alvo (estado da arte)

```text
                    ┌─────────────────────────────┐
  ZIP/XML ─────────►│ Ingestão + tipo (4/5/7)      │
                    │ + detecção WRONG_FICHA_TIPO   │
                    └──────────────┬──────────────┘
                                   ▼
                    ┌─────────────────────────────┐
                    │ Pipeline de findings         │
                    │  LEDI schema → regras FAO#   │
                    │  → Previne x-ray (só FAO)     │
                    │  → severity + repairClass     │
                    └──────────────┬──────────────┘
                                   ▼
                    ┌─────────────────────────────┐
                    │ Treatment engine             │
                    │  buckets · R$ · ↓ desde base │
                    │  fila ordenada vermelho→laranja│
                    └──────────────┬──────────────┘
                                   ▼
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
   AutoBatchFix              SemiAutoForm              IndividualFix
   (sem input)               (1–N campos)              (ficha / XML)
         │                         │                         │
         └─────────────────────────┼─────────────────────────┘
                                   ▼
                    ┌─────────────────────────────┐
                    │ Revalidate item → batch      │
                    │ Advance-to-next blocker      │
                    │ Export ZIP + relatório PDF/MD│
                    └─────────────────────────────┘
```

**Princípios**

1. **Single source of truth:** um registro por `code` com `{ severity, channel, title, why, how, repairMode, ui, fixer, tests }`.  
2. **API-first:** UI só orquestra; nenhum “como corrigir” só no frontend.  
3. **Fail closed em BLOCKER:** não exportar “limpo” se houver bloqueio sem override.  
4. **Automação só se reversível/auditável:** cada fix grava `applied[]` + diff/resumo.  
5. **Mesma UX nos 3 tipos** (FAO/FAI/PROC), regras por schema.

---

## 4. Fases de implementação

### Fase 0 — Fundação da matriz (1–2 dias) ✅

**Objetivo:** tornar cobertura mensurável e impedir regressão.

- [x] Unificar catálogo: `apps/api/src/care-extra/ledi-error-registry.ts` + espelho web `apps/web/src/lib/ledi/error-registry.ts` (`npm run sync:ledi-errors`)
- [x] Cada código: `repairClass: auto|semi|individual|reexport|info` + `implemented`
- [x] Teste CI: `ledi-error-registry.spec.ts` (validator ⊆ registry; AUTO_FIXABLE alinhado; paridade web)
- [x] Incluir códigos órfãos FAI/PROC no registry
- [x] Doc vivo: `docs/rastreabilidade/cobertura-ledi-erros.md`

**Saída:** 78 códigos · pending implement = 8 (P1/P2).

---

### Fase 1 — Fechar 100% do *mapa* de correção (2–3 dias)

**Objetivo:** nenhum código sem caminho explícito A–E.

#### 1.1 Promover a AUTO/SEMI (onde seguro) ✅ P2

| Código | Ação proposta |
|---|---|
| `JUSTIFICATIVA_CPF_UNEXPECTED` | SEMI: remover justificativa **ou** forçar `stNaoPossuiCpf=true` (escolha na UI) ✅ |
| `TP_CDS_ORIGEM_MISSING` / `NOT_3` | AUTO: set `tpCdsOrigem=3` (padrão LEDI PEC) ✅ |
| `PROC_QTD` | AUTO: normalizar quantidade ≥1 ✅ |
| `CONDUTAS_MAX` / `VIGILANCIA_MAX` | AUTO: truncar lista (17 / 7) ✅ |
| `TIPO_CONSULTA_MULTI` | AUTO: manter só o 1º ✅ |
| `UUID_FICHA_LENGTH` | AUTO: regenerar UUID canônico ✅ |

#### 1.2 Individual com campo dedicado (não só “xml”) ✅ P1

| Código | Campo UI |
|---|---|
| `DT_NASCIMENTO_MISSING` | date picker → epoch ms no XML |
| `SEXO_INVALID` | select 0/1 |
| `DATA_ATENDIMENTO_MISSING` / `HORA_*` | date / ISO-epoch |
| `PROF_CNS_*` / `CNS_INVALID` / `CPF_INVALID` | campos CPF/CNS/prof CNS |
| `PATIENT_ID_MISSING` | CPF ou CNS ou st+justificativa |
| `CPF_CNS_BOTH` | select manter CPF ou CNS |
| `CONDUTAS_MISSING` | multi-select condutas |
| `PROC_*` / `TIPO_*` / `ALTA_*` | parcial / ainda P2 |
#### 1.3 Reexport explícito (classe D)

`XML_PARSE_ERROR`, `FORMAT_*`, `*_ROOT_NOT_FOUND`, `WRONG_FICHA_TIPO`, `ATENDIMENTOS_EMPTY`/`MAX`, `UUID_FICHA_MISSING` (se política ≠ regenerar).

UI: badge “Só na origem”, botão **Excluir do lote**, link para tela do tipo certo.

---

### Fase 2 — UX estado da arte no FAO (já avançado → polir) (2–4 dias)

- [ ] **Fila única de tratamento:** sempre próximo BLOCKER → MONEY_RISK → INFO.  
- [ ] **Wizard PATIENT_ID / CPF:** 3 caminhos com preview do XML.  
- [ ] **Editor estruturado** (form por tags críticas) + XML avançado colapsado.  
- [ ] **Diff pós-fix** (“antes/depois” tags tocadas).  
- [ ] **Corrigir N selecionadas** + “todas afetadas” (já existe) com progress bar.  
- [ ] **Atalhos:** Enter salva, Esc fecha com unlock seguro (já com ref-count).  
- [ ] **Relatório de fechamento:** MD/PDF do lote (contagens, R$, códigos restantes, overrides).  
- [ ] Não deixar guia aberto “órfão” sob a ficha sem necessidade (opcional: fechar guia ao abrir ficha, ou minimizar).

---

### Fase 3 — Paridade FAI + Procedimentos (3–5 dias) ✅ P3

- [x] Extrair/reusar shell: `LediTipoLotePage` + `ErrorGuideModal` + `FichaFixModal` (variant).  
- [x] Validador FAI/PROC → blockers compartilhados (st CPF, turno, CNES, INE, nascimento, sexo, local).  
- [x] Fixers por schema: `procedimentosCodes` (PROC) + fixers FAO reutilizados nos blocos FAI/PROC.  
- [x] Catálogo/repair: ABPG → editar SIGTAP na ficha.  
- [ ] Teste de regressão com amostras `18-amostra-novas-fichas` + dump 5974691 (subconjunto CI) — P5/aceite.

---

### Fase 4 — Efetividade e eficiência (motor) ✅ P4

- [x] **Batch plan / pipeline único:** `ledi-autofix.pipeline.ts` (ordem st→equipe→clínica→envelope).  
- [x] **Dry-run:** `POST .../dry-run` + botão na UI.  
- [x] **Idempotência:** teste reaplicar auto-fix.  
- [x] **Políticas municipais (Franca):** `FRANCA_LEDI_DEFAULTS` no dry-run/relatório.  
- [x] Relatório de fechamento: `GET .../closure-report` + download `.md`.  
- [x] Relatório do que falta: `GET .../pending-report` (JSON/CSV/MD) + UI nos 3 lotes.  
- [ ] Cache SIGTAP search como CIAP — backlog menor.  
- [ ] Métricas de tempo operador — backlog.

### Fase 5 — Conformidade normativa e Previne (contínuo)

- [ ] Cruzar NT 30/2025 + LEDI vigente × registry (checklist em `docs/conhecimento/15-…`).  
- [x] Previne B1–B6: ações só com confirmação clínica na UI (não força exodontia).  
- [ ] Indicadores Previne (`14-…`) e vínculos (`15-…`) — backlog.  
- [x] Gate documentado: “Siaps-ready” ≠ “Previne-ideal”.

### Fase 6 — Qualidade / DoD operacional ✅ P5

- [x] Suite golden: BLOCKERs auto em `ledi-p5-golden-pipeline.spec.ts`.  
- [x] Pipeline E2E API/Jest: upload→fix→zip (+ FAI/PROC). (Playwright browser = opcional futuro)  
- [x] Manual técnico + usuário atualizados.  
- [x] `STATUS.md` + plano + `docs/planejamento/aceite-ledi-franca.md`.  
- [x] Checklist aceite Franca (execução ZIP 1131 = operador local / LGPD).

---

## 5. Priorização sugerida (ordem de entrega)

```text
P0  Matriz unificada + CI cobertura + códigos órfãos          ✅
P1  Campos individuais                                        ✅
P2  Semi/auto pending registry                                ✅
P3  Paridade UI FAI/PROC                                      ✅
P4  Dry-run + fila + relatório fechamento                     ✅
P5  Golden + pipeline E2E + aceite (checklist)                ✅
```

---

## 6. KPIs de sucesso

| KPI | Meta |
|---|---|
| Códigos com caminho A–E explícito | **100%** do registry |
| BLOCKER corrigível sem reexport (A+B+C) | ≥ **90%** das ocorrências no lote Franca FAO |
| Tempo operador até lote Siaps-ready (amostra 50 fichas) | ↓ ≥ **50%** vs baseline atual |
| Regressão: teste por código BLOCKER | **1+** por código |
| FAI/PROC: parity de fluxo UX com FAO | **sim** |

---

## 7. Riscos e limites honestos

- **CPF/CNS inválidos** exigem dado real — automação máxima = validar dígito + máscara + st+justificativa.  
- **Previne** é inteligência de produção, não gate Siaps — não misturar no “100% envio”.  
- **Regenerar UUID** pode quebrar rastreio legado — política explícita (default: não regenerar se UUID ausente; só length inválido com confirmação).  
- **Truncar listas** (condutas/vigilância) precisa preview — risco clínico/regulatório.

---

## 8. Próxima ação (pós P5)

1. Operador: rodar aceite com ZIP Franca real (`docs/planejamento/aceite-ledi-franca.md`).  
2. Backlog menor: SIGTAP search paridade CIAP · métricas de tempo · Playwright browser.  
3. Fora do LEDI: UI produto fase 2 · evolução núcleo clínico / RNDS.

---

## Referências

- `STATUS.md`  
- `docs/conhecimento/16-tres-tipos-ficha-ledi-franca.md`  
- `docs/conhecimento/17-catalogo-erros-parser-ledi-fao.md`  
- `apps/web/src/app/odonto/lote/error-catalog.ts`  
- `apps/web/src/app/odonto/lote/repair-catalog.ts`  
- `apps/api/src/care-extra/ledi-fao-xml.fixer.ts`
