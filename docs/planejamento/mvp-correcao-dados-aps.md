# MVP — correção de dados APS / LEDI

**Registrado:** 2026-08-16  
**Escopo:** APS · faturamento/produção · cadastros que alimentam envio. Sem SAMU/LIS/TFD. Sem reinventar código — análise de gap.

**Veredito:** o SIGS já é um **canal de correção pré-Siaps** para o volume dominante do dump Franca (**FAI 4 · FAO 5 · PROC 7**, ~11 955 XMLs). O gap do MVP de “corrigir dados de outros sistemas” **não** é mais o wizard 4/5/7 — é **cadastro mestre completo → vínculo → fechamento CDS/vacina/coletivo → qualidade Previne**, sem motor de indicadores ainda.

---

## A. Fluxo “dado municipal → governo”

```text
ORIGENS
  ├─ e-SUS / SIGS legado (ZIP LEDI tpCdsOrigem=3)  ← dump Franca 5974691
  ├─ Outros sistemas municipais (XML/ZIP mistos)
  └─ Digitação nativa SIGS (/aps · /odonto · /vacinacao · /territorio · /ad · /coletivo)

        ▼
  Adapter LEDI XML → domínio Sigs* (clinical-core)
  + Paciente Mestre (identifiers / match HIGH+MEDIUM queue)
  + Cadastros mestres: CNES municipal · PF · equipes/INE · lotações

        ▼
  Fichas / lotes por tipoDadoSerializado
        ▼
  Validação + autofix (RulePack / registry)
  │   Siaps (BLOCKER)  ≠  Previne (MONEY_RISK / qualidade)
        ▼
  ZIP aptos vs pendentes  →  Siaps / SISAB  →  (RNDS = stub)
  BPA stub paralelo (não é layout DATASUS oficial)
```

| Etapa | SIGS **já faz** | SIGS **ainda não** |
|---|---|---|
| Ingestão ZIP 4/5/7 | Wizard `/faturamento/lote/{fai,fao,proc}` · gate de tipo · jobs async | — |
| Correção em lote | Autofix seguro + semi-auto + ficha a ficha (FAO mais maduro) | Deep-link audit→ficha operacional; motor Previne |
| Migração XML→banco | `POST /v1/clinical-core/{normalize-ledi,migrate-dry-run,migrate}` · match | Bulk UI de migração “outro sistema” end-to-end |
| Cadastro mestre rede | Sync CNES **natureza 1244** (~**66** / **59 ativos** Franca) · PF · `/equipes` · multi-equipe | eSB↔eSF referência · CH 20h · NT 30 “oficial” |
| Produção nativa | Finish APS/odonto → fila + motor; mappers FAI/FAO/vacina/AD/coletivo | Export ZIP nativo de **todos** os tipos CDS |
| CDS 3/8/10 | Domínio + UI origem + **stub** de lote | Wizard ZIP (bloqueado sem amostra) |
| Vacina / coletivo / cad. individual (2) | Domínio + mapper JSON | Lote XML wizard |
| Governo | ZIP Siaps-ready + relatório; BPA stub; RNDS stub | Envio real Siaps/RNDS; BPA oficial; SISAB como produto |

**Papel atual:** **corrigir e filtrar** XML de terceiros (e o que o SIGS gera em 4/5) — ainda **não** “sistema único que substitui todo o CDS no envio”.

---

## B. Inventário do que vai ao governo (por tipo)

Códigos = `TipoDadoTranspEnum` (e-SUS 5.5.24). Contagens Franca = dump `5974691`.

| Código | Nome | Status SIGS | Impacto Siaps/SISAB | Impacto Previne | Risco qualidade |
|---:|---|---|---|---|---|
| **2** | Cadastro Individual | Domínio `/pacientes` + FieldHint; **sem lote XML** | Denominador/pessoa | Quase todos C*/B*/M* | Alto se CNS/CPF/condições falham |
| **3** | Cadastro Domiciliar | Origem `/territorio`; lote **stub** | Território CDS | C2–C6 (VD/contexto) | Alto — sem wizard ZIP |
| **4** | FAI | **Wizard live** · ~**8149** XMLs | Produção APS | C1–C7 | Médio pós-autofix; INE ~31% faltava no dump |
| **5** | FAO | **Wizard live** · ~**1131** | Produção bucal | **B1–B6** (+ C3 gestante) | Alto se só “passa Siaps” (CIAP/`stNaoPossuiCpf`/vigilância 99) |
| **6** | Atividade Coletiva | UI `/coletivo` + mapper; **sem lote ZIP** | Produção coletiva | **B4**, M* | Médio — B4 fora da FAO |
| **7** | Procedimentos | **Wizard live** · ~**2675** | Procedimentos APS | Apoio C* / BPA | **ABPG→SIGTAP** (210 fichas) |
| **8** | Visita ACS | Domínio + lat/long; lote **stub** | Produção ACS | C2–C6 (VD) | Alto sem lote de correção |
| **10** | AD | UI `/ad` + mapper; lote **stub** | Produção AD | Parcial | Médio |
| **14** | Vacinação | Catálogo LEDI v3 (**99** imunos) · seed **54** faixas PNI · **sem lote ZIP**; faixas ≠ `TB_FAIXA` | Produção vacinal | C2/C3/C6/C7 | Alto se faixa/idade errada; detector = **14** (não 2) |
| — | BPA / RNDS | BPA **stub** `/production/bpa/export`; RNDS **stub** | Ambulatorial / futuro | Indireto | BPA ≠ layout oficial |

**Envio corrigível em lote hoje:** só **4, 5, 7**. Catálogo: `GET /v1/faturamento/ledi-cds-lotes`.

---

## C. Onde se perde oportunidade (P0–P2)

| Pri | Onde perde | Evidência | Efeito |
|---|---|---|---|
| **P0** | `stNaoPossuiCpf` ausente | 100% FAI+FAO+PROC no dump | Bloqueia Siaps — SIGS já autofixa no wizard |
| **P0** | FAO sem `problemasCondicoes` | 100% FAO | BLOCKER Siaps **e** base Previne |
| **P0** | CNS/CNES/CBO/INE inconsistentes | INE ~15% FAO / ~31% FAI; CNES 8 dígitos; `CNS_NOT_IN_MUNICIPAL_CNES` | Glosa + denominador errado |
| **P0** | Cadastro mestre ≠ ficha | Audit sem deep-link `/aps`/`/odonto` | Corrige no ZIP, reincidência na origem |
| **P1** | Siaps ok ≠ Previne | Doc 15 + x-ray FAO (015-3, conduta 15, vigilância ≠99) | Dinheiro Previne com XML aceito |
| **P1** | Vínculo pessoa↔equipe (NT 30) | API links existe; motor indicadores **não** | Denominadores C*/B* distorcidos |
| **P1** | Equipes sem membros / multi-equipe | `/equipes` · `TEAM_WITHOUT_MEMBERS` | Header LEDI com INE “fantasma” |
| **P1** | Paciente mestre / duplicata | Match A1–A2; fila MEDIUM sem UX bulk | Produção duplicada |
| **P1** | Vacina: faixas seed ≠ dump | `AGE_SEED_META.officialDumpPresent=false` | C2/C3 vs PNI local |
| **P1** | CDS território (3/8) sem wizard | Stub — dump sem amostra | Sem sanitizar ZIP ACS/domicílio |
| **P2** | ABPG em procedimentos | 210 fichas | BLOCKER/MONEY_RISK |
| **P2** | Coletivo / B4 fora do funil | Tipo 6 sem ZIP | Escovação some do pré-envio |
| **P2** | eSB↔eSF + 20h | Gap modelagem (doc 15) | B1/B4 |
| **P2** | Audit `sourceId` truncado | UI auditoria | Filas já têm `?encounterId=` — ciclo incompleto |

Enviar “só para passar no Siaps” **abre a porta**; maximizar Previne exige vínculo + CIAP/CID + SIGTAP certo + janelas de conclusão.

---

## D. Gap MVP “correção de dados”

Objetivo: **importar / sanitizar / reexportar** antes do governo, com CNES/equipes como cadastro mestre.

### P0 — reforçar o ciclo (já quase)

1. Manter wizard **4/5/7** + registry + export 2 ZIPs (não regredir).
2. **CNES municipal + PF + equipes** como fonte do header — obrigar INE/CBO na lotação antes de finish nativo.
3. **Auditoria** `RF-10.21` → deep-link fila/ficha (`encounterId` / lote item).
4. Pipeline **clinical-core migrate** em lote com relatório (API existe; falta produto operacional).

### P1 — falta para “correção de outros sistemas”

5. **Wizard CDS 3/8/10** — bloqueado até amostra XML ([desenho](desenho-lote-ledi-cds-3-8-10.md)).
6. **Lote vacina (14)** — mapper JSON existe; falta wizard/ZIP + dump `TB_FAIXA_ETARIA_VACINACAO`.
7. **Cadastro individual (2)** — campos CDS + FieldHint; falta lote LEDI.
8. **Vínculo paciente↔equipe** como gate Previne + consistência INE CNES.
9. **Sanitização identidade:** CNS módulo 11, `stNaoPossuiCpf`, unificação MEDIUM com UX.
10. **Mapa ABPG→SIGTAP** no fluxo PROC.

### P2 — qualidade / financiamento

11. Relatório pré-envio **B1–B6** (x-ray FAO parcial).
12. Motor indicadores C*/B*/CR*/M* ([doc 14](../conhecimento/14-indicadores-aps-previne-brasil.md) = spec; **não implementado**).
13. Coletivo (6) no funil; eSB↔eSF + 20h.
14. BPA oficial / RNDS real (fora do MVP correção LEDI).

**Fora:** SAMU, LIS, TFD, Claude Design UI.

---

## E. Roadmap — fechamento do protótipo (1–8)

| # | Entrega | Critério de pronto | Dependência |
|---|---|---|---|
| **1** | Deep-link auditoria → fila/ficha + CSV acionável | Finding abre `/faturamento/{aps\|odonto}?encounterId=` | Código atual |
| **2** | Gate lotação 100% CNS+CBO+CNES+INE no finish FAI/FAO | 0 finish com INE vazio se equipe tem INE no CNES | `/equipes` + PF |
| **3** | Migração ZIP→Paciente Mestre em job (dry-run + persist + relatório) | UI técnica mínima ou CLI; sem PHI | `clinical-core` |
| **4** | PROC: ABPG→SIGTAP + regressão `stNaoPossuiCpf` | Golden + smoke | Dump padrões |
| **5** | Vacina: overlay `TB_FAIXA` **quando houver dump** + esqueleto lote 14 | `officialDumpPresent=true` ou stub honesto | Amostra municipal |
| **6** | CDS 3/8/10 wizard **após** ZIP amostra | Mesmo shell `LediTipoLotePage` | Bloqueio STATUS |
| **7** | Vínculo NT 30 mínimo: cobertura paciente↔INE + alertas | Relatório “sem vínculo / equipe inativa” | Territory + CNES |
| **8** | Pré-envio Previne bucal B1–B6 (contagens) | Painel no fechamento lote FAO | `ledi-fao-previne-xray` |

Ordem: **1→2→3→4** fecham correção com o que Franca já tem; **5–6** dependem de amostra; **7–8** = “não só aceito, mas financiável”.

---

## Âncoras no repo

| Tema | Caminho |
|---|---|
| Status / smoke | `STATUS.md` · `npm run smoke:cnes-pf-ledi` |
| Fluxo wizard | [fluxo-lote-ledi-wizard.md](fluxo-lote-ledi-wizard.md) |
| Stubs CDS 3/8/10 | [desenho-lote-ledi-cds-3-8-10.md](desenho-lote-ledi-cds-3-8-10.md) |
| Tipos Franca 4/5/7 | [16-tres-tipos-ficha-ledi-franca.md](../conhecimento/16-tres-tipos-ficha-ledi-franca.md) |
| Siaps × Previne | [15-faturamento-indicadores-campos-obrigatorios.md](../conhecimento/15-faturamento-indicadores-campos-obrigatorios.md) |
| Indicadores Previne | [14-indicadores-aps-previne-brasil.md](../conhecimento/14-indicadores-aps-previne-brasil.md) |
| Motor / paciente mestre | [arquitetura-fhir-motor-paciente-mestre.md](arquitetura-fhir-motor-paciente-mestre.md) |
| Detector / códigos | `apps/api/src/care-extra/ledi-ficha-tipo.ts` |
| Auditoria faturamento | `apps/api/src/faturamento/faturamento-audit.service.ts` |
| Catálogo live/stub | `apps/api/src/faturamento/ledi-cds-lote.stub.ts` · `GET /v1/faturamento/ledi-cds-lotes` |
