# Faturamento federal × Indicadores APS — vínculos e campos obrigatórios

**Registrado:** 2026-08-12  
**Por quê:** Dados aceitos pelo Ministério (LEDI → Siaps / SISAB) **e** bem preenchidos alimentam o **Previne Brasil**. Sem vínculo e sem campos mínimos, a ficha pode ser rejeitada **ou** aceita “vazia” — e o município perde pontos/financiamento.  
**Fontes:** Guia CONASEMS jul/2026 (`14-indicadores-aps-previne-brasil.md`) · LEDI FAO · lote Franca 5974691 · NT 30/2025 (vínculo — texto integral ainda a obter)

---

## 1. Dois eixos de dinheiro (não confundir)

| Eixo | O que o governo usa | Se falhar |
|---|---|---|
| **A — Produção (envio LEDI)** | Fichas (FAO, FAI, vacina…) aceitas no Siaps/SISAB | Rejeição / não contabiliza atendimento |
| **B — Indicadores (Previne)** | Contagens e scores sobre a produção **já aceita** + cadastro/vínculo | Indicador baixo → impacto no repasse por cumprimento |

Regra de produto no SIGS:

> **Enviar bem (eixo A) é pré-requisito de pontuar bem (eixo B).**  
> O validador LEDI e o futuro motor de indicadores devem compartilhar a mesma lista de campos obrigatórios de qualidade.

---

## 2. Vínculos obrigatórios (infraestrutura de denominador)

Sem estes vínculos, o numerador pode “existir” no XML e o denominador Previne ficar errado (ou zerado).

| Vínculo | Para quê | Impacto Previne | Impacto LEDI/Siaps | Status SIGS |
|---|---|---|---|---|
| **Pessoa ↔ Equipe (NT 30/2025)** | Denominadores “vinculados à equipe” | Quase todos C*, B1/B4, M* | Indireto (cadastro) | **Gap** — implementar |
| **Profissional ↔ CBO ↔ CNES ↔ INE** | Header de produção + elegibilidade CBO do indicador | Todos (filtro CBO) | **Obrigatório** no header | Parcial (lotação existe; INE faltou em 15% do lote FAO) |
| **eSB ↔ eSF/eAP de referência** | Denominador B1/B4 (população da eSF) | B1, B4 | Qualidade / consistência | Gap de modelagem |
| **Carga horária eSB (20h)** | Denominador B1/B4 ÷ 2 | B1, B4 | — | Gap |
| **CPF ou CNS válido + `stNaoPossuiCpf`** | Identificar pessoa no numerador/denominador | Todos | **BLOCKER** LEDI | Corrigível no lote FAO |
| **Gestação/puerpério/DM/HAS/TB** (CID/CIAP) | Abrir denominador de scores clínicos | C3–C5, CR2, CR4 | Qualidade FAI/FAO | Parcial |

### Prioridade de vínculo para Franca (agora)

1. **Lotação completa:** CNS profissional + CBO odonto + CNES + **INE** em 100% das fichas FAO.  
2. **Identificação do cidadão:** CNS/CPF + `stNaoPossuiCpf` boolean.  
3. **INE da eSB e vínculo eSB→eSF** (cadastro municipal) — sem isso B1/B4 distorcem.  
4. **NT 30/2025** — serviço de vínculo (próximo ciclo; bloquear denominadores “oficiais” até existir).

---

## 3. Campos obrigatórios de qualidade (envio → indicador)

### 3.1 Camada comum (toda ficha LEDI)

| Campo | Obrigatório envio | Por que melhora indicador / faturamento |
|---|---|---|
| `uuidFicha` / UUID estável | Sim | Evita duplicar produção |
| `tpCdsOrigem = 3` | Sim (terceiros) | Aceite LEDI |
| `codigoIbgeMunicipio` | Sim | Escopo municipal |
| `cnes` + `ine` | Sim / fortemente recomendado | Equipe no denominador |
| `profissionalCNS` + `cboCodigo_2002` | Sim | Filtro CBO do indicador |
| `cnsCidadao` **ou** `cpfCidadao` + `stNaoPossuiCpf` | Sim | Pessoa única no Previne |
| `dataHoraInicial/Final` / data atendimento | Sim | Janelas 6/12/36/60 meses |
| Tipo de atendimento / demanda | Depende da ficha | C1 (programada vs espontânea) |

### 3.2 Saúde bucal (ESB) — o que o lote FAO precisa “fechar” para B1–B6

Cruzamento direto com o lote 5974691 e o Guia CONASEMS:

| Campo / regra FAO | Bloqueio LEDI hoje | Indicador Previne | Ação no SIGS |
|---|---|---|---|
| `stNaoPossuiCpf` | BLOCKER 100% | Pessoa contável | Auto-fix + enforce no finish |
| `problemasCondicoes` (CIAP/CID) | BLOCKER 100% | Qualidade clínica; apoio a scores clínicos se houver | Enforce no finish; UI lote |
| `ine` / `ineDadoSerializado` | WARN 15% | Vínculo equipe / B* | Obrigar na lotação eSB |
| `tiposConsultaOdonto` quando `tipoAtendimento=2` | BLOCKER raro | Qualidade consulta | Enforce |
| Conduta **15** (tratamento concluído) + consulta 1 ou 2 | BLOCKER raro | **B2** (numerador) | Enforce + orientar UI |
| Procedimento **03.01.01.015-3** (1ª consulta programada) | Não validado como $ | **B1** numerador / **B2** denom | Catálogo + alerta se faltar no fluxo “primeira consulta” |
| Procedimentos preventivos / ART / exodontia (listas B3–B6) | Parcial | **B3, B5, B6** | Validar SIGTAP na finalização odonto |
| Escovação coletiva **01.01.02.003-1** | Fora da FAO individual | **B4** | Ficha/atividade coletiva — não misturar com FAO |
| Vigilância saúde bucal ≠ 99 em massa | Qualidade | Produção/vigilância útil | Desencorajar “outro” default |
| CBO 2232-08 / 2232-93 / 2232-72 (e TSB quando cabível) | CBO ok no lote (223208) | Elegibilidade B* | Manter mapa CBO↔indicador |

**Leitura do lote Franca:**  
Mesmo após aceitar o XML no Siaps, **B1/B2** só sobem se existirem 1ª consulta programada (015-3) e conclusão de tratamento bem marcada; **B3/B5/B6** dependem do mix SIGTAP. Corrigir só `stNaoPossuiCpf` + CIAP **abre a porta do envio**; não basta para maximizar Previne bucal.

### 3.3 ESF/EAP (C*) — campos que o atendimento APS precisa carregar

| Necessidade | Campos / eventos | Indicadores |
|---|---|---|
| Demanda programada vs espontânea | Tipo de demanda no atendimento | **C1** |
| Puericultura | Consultas + peso/altura mesmo registro + VD ACS + vacinas calendário | **C2** |
| Gestação/puerpério | CID/CIAP gestação (com exclusão aborto) + PA + antropometria + VD + dTpa + TR IST + odonto gestante | **C3** (+ B se odonto) |
| Diabetes / HAS | CID/CIAP condição + consulta 6m + PA + antropometria + VD + HbA1c/pés (DM) | **C4, C5** |
| Idoso | Idade ≥60 + consulta + antropometria + VD + influenza | **C6** |
| Mulher / rastreio | Faixa etária por BP + citopatológico/HPV/mamografia + HPV vacina + atendimento SSR | **C7** |

### 3.4 eCR / eMulti (resumo)

- **eCR:** identificação de pessoa em situação de rua (12m) + consultas 6m (CR1); gestação/IST/TB com exames e CBOs certos (CR2–CR4).  
- **eMulti:** CBO da lista eMulti + flag de **ação compartilhada** (profissional principal/secundário) para **M2**.

---

## 4. Matriz prática — o que o SIGS deve **bloquear** vs **alertar**

Severidade sugerida no produto (alinhada ao validador FAO):

| Severidade | Quando | Exemplos |
|---|---|---|
| **BLOCKER envio** | Sem isso a ficha não deve ir ao Siaps | `stNaoPossuiCpf`, CPF/CNS, CBO, CNES, `problemasCondicoes` (FAO), regras conduta 15 |
| **MONEY_RISK / Previne** | Envia, mas indicador/financeiro sofre | Sem INE; sem 015-3 no fluxo de 1ª consulta; vigilância 99; sem conduta conclusão; eSB 20h sem regra ÷2 |
| **QUALITY_WARN** | Melhora qualidade / auditoria | Intervalo 30d entre VD; janelas incompletas; CIAP genérico |

### Checklist mínimo antes de liberar lote odonto ao Ministério

- [ ] 100% com `stNaoPossuiCpf` coerente  
- [ ] 100% com ≥1 CIAP ou CID em `problemasCondicoes`  
- [ ] 100% com INE da eSB (e CNES)  
- [ ] Lotação CBO odonto elegível B*  
- [ ] Onde houver 1ª consulta programada → SIGTAP `0301010153` (ou equivalente LEDI 03.01.01.015-3)  
- [ ] Onde houver alta/conclusão → conduta 15 + tipo consulta permitido  
- [ ] Relatório pré-envio: contagem estimada B1–B6 (mesmo sem motor Previne completo)

---

## 5. Ordem de implementação sugerida (sem abandonar o FAO)

```text
1. Fechar eixo A odonto (já em curso)
   - correção lote XML + enforce finish
   - INE obrigatório na lotação eSB

2. Campos Previne-bucal no mesmo fluxo (eixo B mínimo)
   - mapear SIGTAP → B1..B6 no pré-envio
   - alertas MONEY_RISK no /odonto/lote e no finish

3. Cadastro de vínculo
   - eSB ↔ eSF referência + flag 20h
   - rascunho NT 30/2025 (mesmo que parcial)

4. Motor indicadores (C/B/CR/M)
   - começar por B1–B6 (dados já no FAO)
   - depois C1 (tipo demanda) e C3/C4/C5 (condições)
```

---

## 6. Mensagem para o município

Enviar XML “só para passar no Siaps” **não** maximiza faturamento.  
O financiamento Previne depende de **vínculo de equipe + identificação da pessoa + CBO correto + procedimentos certos + conclusão/consultas nas janelas**.  

O SIGS deve tratar isso como **qualidade de produção federal**, não como relatório opcional.

---

## Referências internas

- `docs/conhecimento/14-indicadores-aps-previne-brasil.md`  
- `docs/conhecimento/analise-lote-fao-5974691.md`  
- `docs/conhecimento/11-legado-faturamento-e-producao.md`  
- Validador: `apps/api/src/care-extra/ledi-fao.validator.ts`  
- UI lote: `/odonto/lote`
