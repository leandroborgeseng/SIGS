# Especificação Técnica — Indicadores APS (Previne Brasil / e-SUS APS)

**Fonte:** Guias de Bolso "Indicadores da Atenção Primária à Saúde" (CONASEMS, atualização julho/2026)  
**Registrado em:** 2026-08-12  
**Status no SIGS:** especificação — motor de cálculo ainda não implementado  
**Dependência normativa citada:** Nota Técnica nº 30/2025-CGESCO/DESCO/SAPS/MS (vinculação pessoa↔equipe; texto integral a obter)

Cobertura: 4 tipos de equipe · **19 indicadores**

| Prefixo | Equipe | Indicadores |
|---|---|---|
| `C1`–`C7` | ESF/EAP | Saúde da Família / Atenção Primária |
| `B1`–`B6` | ESB | Saúde Bucal |
| `CR1`–`CR4` | eCR | Consultório na Rua |
| `M1`–`M2` | eMulti | Multiprofissional |

Para cada indicador: objetivo, fórmula (razão ou score de boas práticas), elegibilidade, janelas, faixas (Ótimo/Bom/Suficiente/Regular), CBOs e códigos (CID-10, CIAP-2, SIGTAP, vacina).

---

## 1. Modelo de dados e conceitos gerais (pré-requisito)

### 1.1 Entidades base
- **Pessoa/Cidadão**: CPF ou CNS válido; data de nascimento; sexo/gênero (incl. homens transgênero onde aplicável); vínculos de condição (gestante, puérpera, diabetes, hipertensão, tuberculose etc.).
- **Equipe**: tipo (eSF, eAP, eSB, eCR, eMulti), CNES, INE.
- **Vínculo pessoa↔equipe**: NT nº 30/2025 — pré-requisito dos denominadores por "pessoas vinculadas".
- **Profissional**: CNS + CBO (elegibilidade por indicador).
- **Atendimento/Registro clínico**: individual (presencial/remoto), coletiva, visita domiciliar, procedimento, exame/teste, vacina — com data, profissional, CBO, CID-10/CIAP-2, SIGTAP, imunobiológico.
- Fonte de referência no mundo real: **e-SUS APS (CDS/PEC)**. O SIGS deve mapear seus registros para o mesmo conjunto de atributos.

### 1.2 Dois padrões de fórmula

**(a) Razão simples** (ex.: C1, B1–B6, CR1, M1–M2):
```
indicador = numerador / denominador
```

**(b) Score de boas práticas** (ex.: C2–C7, CR2–CR4):
```
para cada pessoa elegível:
    pontuação_pessoa = soma dos pontos das boas práticas (A, B, C, …)  // total 100
indicador = (soma pontuações) / (nº pessoas no denominador)  // média 0–100
```

Cada boa prática = booleana (atendida/não), com janela e regras próprias; resultado por pessoa/período de referência.

### 1.3 Classificação por parâmetro
Quatro faixas: `Ótimo`, `Bom`, `Suficiente`, `Regular`. Limites **variam por indicador**. Alguns têm Regular nas duas pontas (ex. C1, B3, B5).

### 1.4 Períodos de apuração
Janelas por evento (gestação, criança ≤2 anos), móveis (6/12/24/36/60 meses) ou cumulativas (quadrimestre/ano). Cada indicador define a sua.

---

## 2. ESF/EAP — C1 a C7

### C1 — Mais Acesso
**Tipo:** razão · demanda programada / total de demandas  
**Num:** atendimentos demanda programada (consulta agendada programada; cuidado continuado; consulta agendada)  
**Den:** todos os tipos (espontânea + programada)  
**Parâmetro:** Ótimo `>50 e ≤70` | Bom `>30 e ≤50` | Suficiente `>10 e ≤30` | Regular `≤10 ou >70`  
**CBO:** 2251-42, 2251-70, 2251-30, 2251-25, 2252-50, 2235-65, 2235-05  
**Códigos clínicos:** N/A (tipo de demanda)

### C2 — Cuidado no Desenvolvimento Infantil
**Tipo:** score · crianças ≤2 anos vinculadas  
**Parâmetro:** Ótimo `>75–100` | Bom `>50–75` | Suficiente `>25–50` | Regular `≤25`  
**Boas práticas (20 pts cada, janela até 2 anos):**
| Cód | Critério |
|---|---|
| A | 1ª consulta presencial médico/enfermeiro até 30º dia |
| B | ≥9 consultas presenciais/remotas até 2 anos |
| C | ≥9 registros simultâneos peso+altura até 2 anos |
| D | ≥2 VD ACS/TACS: 1ª ≤30 dias, 2ª ≤6 meses |
| E | Vacinas completas (difteria, tétano, coqueluche, HepB, Hib, polio, SCR, pneumo) |

**CBO:** 2235; 2231/2251/2252/2253; 2232; 2234; 2236; 2238; 2237; 2241; 3222; 2239; 5151-05; 3222-55  
**Procedimentos:** 01.01.04.002-4, 01.01.04.008-3, 01.01.04.007-5, 03.01.01.026-9, 03.01.01.027-7, 03.01.01.025-0  
**Vacinas:** 09, 17, 29, 39, 42, 43, 46, 47, 58, 22, 24, 56, 26, 59, 106, 107

### C3 — Cuidado na Gestação e Puerpério
**Tipo:** score · gestantes/puérperas vinculadas · por gestação  
**Parâmetro:** igual C2  
**Boas práticas:** A(10) 1ª consulta ≤12ª semana; B(9) ≥7 consultas; C(9) ≥7 PA; D(9) ≥7 peso+altura; E(9) ≥3 VD ACS após 1ª PN; F(9) dTpa ≥20ª sem.; G(9) TR sífilis/HIV/HepB/C 1º trim.; H(9) TR sífilis/HIV 3º trim.; I(9) ≥1 consulta puerpério; J(9) ≥1 VD puerpério; K(9) ≥1 saúde bucal dentista/TSB  

**Identificação gestação/puerpério (crítico):**
- CID gestação: O10–O16, O20–O26, O28–O36, O40, O41, O43, O44, O46–O48, O75.2, O75.3, O98, O99.0–O99.7, Z32.1, Z33–Z36, Z64.0
- CID puerpério: F53*, M83.0, O10, O15.2, O26.6, O72.2/3, O85–O87, O90–O92, O94, O98, O99, Z37*, Z38, Z39
- CID exclusão (aborto): O02, O02.1, O03–O06, Z30.3
- CIAP gestação: W03, W78, W79, W81, W84, W85
- CIAP puerpério: 48, 49, P29, W18, W19, W70, W90–W96
- CIAP exclusão: W82, W83

**Vacina:** 57 dTpa adulto · **Procedimentos:** antropometria, PA, consultas PN/puerperal/tele, testes HIV/sífilis/HepB/C (listas do guia)

### C4 — Diabetes
**Tipo:** score · pessoas com diabetes vinculadas  
**Boas práticas:** A(20) ≥1 consulta 6m; B(15) PA 6m; C(15) peso+altura 12m; D(20) ≥2 VD ACS intervalo ≥30d em 12m; E(15) HbA1c 12m; F(15) exame dos pés 12m  
**CID:** E10, E11, E14 · **CIAP:** T89, T90  
**Procedimentos:** antropometria, PA, consultas, 03.01.04.009-5 pé diabético, 02.02.01.050-3 HbA1c, ABEX008

### C5 — Hipertensão
**Tipo:** score · hipertensos vinculados  
**Boas práticas:** A(25) consulta 6m; B(25) PA 6m; C(25) peso+altura 12m; D(25) ≥2 VD ACS ≥30d em 12m  
**CID:** I10–I13*, I15*, O10*, O11 · **CIAP:** K86, K87

### C6 — Pessoa Idosa (≥60)
**Tipo:** score · idade ≥60  
**Boas práticas:** A(25) consulta 12m; B(25) peso+altura mesmo dia 12m; C(25) ≥2 VD ACS ≥30d 12m; D(25) 1 dose influenza 12m  
**Vacinas:** 33, 77

### C7 — Mulher / prevenção câncer
**Tipo:** score **segmentado por boa prática** (cada letra tem faixa etária própria)  
**Boas práticas:**
| Cód | Critério | Faixa | Pts |
|---|---|---|---|
| A | Rastreio colo útero 36m (HPV molecular 60m) | 25–64 | 20 |
| B | ≥1 dose HPV | fem. 9–14 | 30 |
| C | Atendimento saúde sexual/reprodutiva 12m | 14–69 | 30 |
| D | Rastreio mama 24m | 50–69 | 20 |

**Vacinas:** 67, 93 · **Procedimentos:** mamografia, citopatológico, HPV molecular 02.02.10.025-1, consultas · CID/CIAP: listas do guia (N80*, N91–N97*, Z12.3/4, Z30*, etc.)

---

## 3. ESB — B1 a B6

### B1 — Primeira Consulta Programada
**Razão:** pessoas com 1ª consulta odonto programada / vinculadas à eSF-eAP de referência  
**Deduplicação:** 1× por dentista a cada 12 meses (a partir da conclusão do tratamento ou da 1ª consulta)  
**eSB 20h × 1 eSF:** denominador ÷ 2  
**Parâmetro:** Ótimo `>1,25` | Bom `>0,75–1,25` | Suficiente `>0,25–0,75` | Regular `≤0,25`  
**CBO:** 2232-08, 2232-93, 2232-72 · **Proc:** 03.01.01.015-3

### B2 — Tratamento Concluído
**Razão:** tratamentos concluídos / 1ªs consultas programadas (mesma deduplicação B1)  
**Parâmetro:** Ótimo `>75–100` | … | Regular `≤25`

### B3 — Taxa de Exodontia
**Razão:** exodontias / (preventivos + curativos + exodontias)  
**Parâmetro:** Ótimo `≥3 e <10` | Bom `≥10–<12` | Suficiente `≥12–<14` | Regular `<3 ou ≥14`  
**Num procs:** 04.14.02.013-8, 04.14.02.014-6 · Den: lista completa do guia

### B4 — Escovação Supervisionada
**Razão:** crianças 6–12 em ação coletiva / crianças 6–12 vinculadas (÷2 se eSB 20h)  
**Parâmetro:** Ótimo `>1` | Bom `>0,5–1` | Suficiente `>0,25–0,5` | Regular `≤0,25`  
**Proc:** 01.01.02.003-1 · CBO dentista + TSB + ASB

### B5 — Procedimentos Preventivos
**Razão:** preventivos individuais / todos individuais  
**Parâmetro:** Ótimo `≥65–85` | Bom `≥55–<65` | Suficiente `≥40–<55` | Regular `<40 ou >85`

### B6 — ART
**Razão:** ART 03.07.01.007-4 / restaurações (inclui ART)  
**Parâmetro:** Ótimo `>8` | Bom `>6–8` | Suficiente `>3–6` | Regular `≤3`

---

## 4. eCR — CR1 a CR4

### CR1 — Mais Acesso eCR
**Razão:** pessoas com atendimento médico/enfermeiro/dentista últimos **6m** / identificadas eCR últimos **12m**  
**Parâmetro:** score-like `>75–100` … Regular `≤25`

### CR2 — Gestação eCR
**Score** por gestação · BP: A(30) ≥3 consultas 1/trimestre; B(20) TR IST; C(20) dTpa ≥20ª; D(20) ≥3 PA; E(10) saúde bucal  
**CID/CIAP gestação:** listas do guia (exclusão aborto igual espírito C3)

### CR3 — Rastreio IST
**Score** · 4 BP × 25 pts (sífilis, HIV, HepB, HepC) em 12m · denom = identificadas eCR 12m

### CR4 — Tuberculose eCR
**Score** · denom = TB identificada últimos **6m** · BP 25 pts: ≥4 consultas; baciloscopia; RX tórax; TR HIV  
**CID:** A15*, A16*, A17

---

## 5. eMulti — M1 e M2

### M1 — Média de atendimentos por pessoa
**Razão:** (atend. individuais + coletivos) / pessoas com ≥1 individual OU ≥1 coletiva (vínculo NT 30/2025)  
**Parâmetro:** Ótimo `>3` | Bom `>2–3` | Suficiente `>1–2` | Regular `≤1`  
**CBO eMulti:** lista completa do guia (assistente social, farmácia, fisio, fono, médicos especialistas, enfermeiro, nutri, educ. física, psicólogo, sanitarista, TO, arte-educador, etc.)

### M2 — Ações interprofissionais
**Razão:** ações compartilhadas / total de ações  
**Compartilhada se:** eMulti+equipe vinculada (eSF/eSFR/eCR/eAP/UBSF) OU eMulti+eMulti (≥1 CNS eMulti principal/secundário) OU eMulti+eSB OU eMulti+qualquer APS com CNS/CPF  
**Parâmetro:** Ótimo `>5` | Bom `>2,5–5` | Suficiente `>1–2,5` | Regular `≤1`

---

## 6. Tabela consolidada de classificação

| Ind. | Ótimo | Bom | Suficiente | Regular |
|---|---|---|---|---|
| C1 | >50 e ≤70 | >30 e ≤50 | >10 e ≤30 | ≤10 ou >70 |
| C2–C7, CR1–CR4 | >75 e ≤100 | >50 e ≤75 | >25 e ≤50 | ≤25 |
| B1 | >1,25 | >0,75 e ≤1,25 | >0,25 e ≤0,75 | ≤0,25 |
| B2 | >75 e ≤100 | >50 e ≤75 | >25 e ≤50 | ≤25 |
| B3 | ≥3 e <10 | ≥10 e <12 | ≥12 e <14 | <3 ou ≥14 |
| B4 | >1 | >0,5 e ≤1 | >0,25 e ≤0,5 | ≤0,25 |
| B5 | ≥65 e ≤85 | ≥55 e <65 | ≥40 e <55 | <40 ou >85 |
| B6 | >8 | >6 e ≤8 | >3 e ≤6 | ≤3 |
| M1 | >3 | >2 e ≤3 | >1 e ≤2 | ≤1 |
| M2 | >5 | >2,5 e ≤5 | >1 e ≤2,5 | ≤1 |

---

## 7. Diretrizes de implementação (SIGS)

1. **Motor por boa prática:** `avaliar_boa_pratica(pessoa, indicador, letra, data_ref) -> bool` — CBO, procedimentos/vacinas, janela, contagem mínima, intervalo mínimo entre eventos.
2. **Motor de vinculação** NT 30/2025 — serviço compartilhado (obter texto integral).
3. **Motor de condição clínica** (gestação, puerpério, DM, HAS, TB) com exclusões (aborto).
4. **Janelas móveis** parametrizáveis (6/12/24/36/60).
5. **Agregação** equipe × período (ex. quadrimestre Previne) + histórico.
6. **Rastreabilidade:** cada BP atendida aponta registros de origem.
7. **Prioridade atual do produto:** Lote LEDI FAO (faturamento odonto). Indicadores entram após estabilizar produção/XML — ou em paralelo se solicitado.

### Mapeamento preliminar → domínio SIGS existente
| Conceito indicador | Onde já existe / gap |
|---|---|
| Atendimento + CID/CIAP | encounters / dental / production batches |
| Procedimento SIGTAP | `apps/api` SIGTAP + procedimentos odonto FAO |
| Vacina | módulo vaccinations |
| CBO / lotação | `ledi/lotacao.resolver` + ProfessionalAssignment |
| Equipe CNES/INE | Facility / Team |
| Vínculo NT 30/2025 | **gap** |
| Score BP + faixas | **gap** (novo módulo `indicators` / APS Previne) |
| Tipo demanda programada vs espontânea (C1) | **gap** no registro de atendimento |

---

## 8. Texto integral recebido (referência)

O conteúdo detalhado completo (listas longas de CID/procedimentos por indicador) foi fornecido pelo produto em 2026-08-12 e condensado acima. Em caso de divergência, preferir o Guia de Bolso CONASEMS julho/2026 e a NT 30/2025.
