# Plano de implementação até o MVP — SGS (Franca)

**Atualizado:** 2026-08-10  
**Premissa:** construir sistema **novo** (não copiar e-SUS); usar e-SUS como fonte de specs APS; TR como contrato; manuais desde a 1ª feature.

---

## 1. O que é o MVP

**MVP = operação mínima viável de APS em 1 UBS piloto**, com:

- Login, perfis, auditoria básica, Central de Ajuda (manuais)
- Cadastros essenciais (unidade, profissional, equipe, cidadão/paciente, território básico)
- Agenda + acolhimento/entrada
- Atendimento clínico APS mínimo (SOAP/procedimentos/CIAP-CID básicos, encerramento)
- Vacinação básica (aplicação + cartão simples)
- Produção/exportação APS **mínima** (caminho LEDI/preparação — mesmo que stub versionado)
- Relatórios operacionais mínimos (lista de atendimentos, vacinas do dia)

**Fora do MVP (fase 2+):** farmácia/estoque CAF, hospitalar/UPA, PPI, contratualização, portal cidadão amplo, regulação completa, BI avançado, 2FA/Gov.br (podem entrar como “MVP+” se priorizados).

**Adiados do esforço inicial (decisão 2026-08-10; podem voltar):** SAMU, Laboratorial/LIS, Transporte/TFD — ver `docs/requisitos/gap-analysis.md` (backlog ativo **457 RF** de 601).

Justificativa: o TR tem **601 RF**; com o corte acima o teto inicial é **457**. O MVP prova arquitetura, manuais in-app, cadastro longitudinal e atendimento APS — base dos outros módulos.

---

## 2. Fases

```text
F0  Fundação (docs, pipeline e-SUS, design system UI)
F1  Plataforma + manuais in-app
F2  Cadastros + território
F3  Agenda + atendimento APS
F4  Vacinação + produção mínima
F5  Hardening piloto (perf, auditoria, treinamento)
─── MVP release 0.1.0
F6+ Módulos TR restantes por prioridade Secretaria
```

### F0 — Fundação (em andamento)

| Item | Status |
|---|---|
| Inventário e-SUS 5.5.24 | ✅ |
| Toolchain CFR/JDK | ✅ |
| RF TR gravados | ✅ |
| Política de manuais | ✅ |
| Prompt Claude Design | ✅ (este pacote) |
| Decompilação P0 + specs patient/encounter/vaccination | ⏳ |
| Entrega UI do Claude Design → implementação | ⏳ |

### F1 — Plataforma

- Auth (usuário/senha), grupos/perfis, sessão
- Shell da aplicação (nav, dashboard inicial simples)
- Auditoria (create/update/delete + consulta básica)
- **Central de Ajuda** + versionamento de artigos + `?` contextual
- Multi-unidade (ao menos selecionar unidade de trabalho)

### F2 — Cadastros

- Unidade (CNES), profissional (CNS/CBO), equipe (INE)
- Paciente/cidadão (CPF/CNS, mãe, nasc., endereço)
- Território/domicílio **simplificado** (microárea + vínculo equipe)
- Listagens + busca + prontuário **somente leitura** sem abrir atendimento

### F3 — Agenda + atendimento

- Agenda profissional / slots
- Entrada do paciente (agendado ou espontâneo)
- Fila por etapa (mínimo: aguardando → em atendimento → finalizado)
- Atendimento: anamnese/SOAP simplificado, CID/CIAP, procedimentos, desfecho
- Histórico do paciente na consulta

### F4 — Vacinação + produção

- Cadastro básico vacina/dose/estratégia (pode vir seed)
- Aplicação por paciente (lote/validade)
- Cartão de vacina (impressão/PDF simples)
- Geração de payload/produção APS (mesmo que fila interna + export stub versionado)

### F5 — Piloto

- Correções, performance, backup, treinamento UBS
- Manuais revisados + release notes 0.1.0

---

## 3. Backlog MVP (épicos → entregáveis)

| ID | Épico | Entregáveis | RF âncora (exemplos) | Manuais |
|---|---|---|---|---|
| E0 | Design UI | Design system + telas MVP | — | — |
| E1 | Plataforma | Auth, roles, shell, auditoria, ajuda | 1.2–1.4, 1.14, 1.20–1.26, 1.30 | plataforma.* |
| E2 | Cadastros mestres | Unidade, profissional, equipe | 2.1, 2.2, 2.19, 2.28, 2.47, 2.60–61 | cadastros.* |
| E3 | Cidadão/território | Paciente, domicílio básico, vínculo | 2.27, 2.29, 2.30, 2.56–58 | cadastros.paciente |
| E4 | Agenda | Grades, encaixe, faltas | 2.17–18, 3.5, 3.7 | agenda.* |
| E5 | Atendimento APS | Fila, SOAP, proc., desfecho | 3.1–3.6, 3.24–30, 3.44, 3.55 | ambulatorial.* |
| E6 | Vacinação | Aplicação + cartão | 14.1–2, 14.11–14 | vacinacao.* |
| E7 | Produção mínima | Export/fila LEDI-ready | 10.3, 10.20 (parcial) | integracao.producao |
| E8 | Relatórios mínimos | Atendimentos, vacinas do dia | 16.1, 16.7 (parcial) | analises.* |
| E9 | Piloto | Treino, bugs, aceite UBS | — | releases/0.1.0 |

---

## 4. Estimativa de esforço

### Premissas

| Premissa | Valor |
|---|---|
| Time | 1 tech lead/fullstack + 1 dev + (UI já pronta via Claude Design) |
| Capacidade líquida | ~8–9 pessoa-dias/semana (2 pessoas) |
| Qualidade | testes críticos + manuais em toda feature |
| Specs e-SUS | paralelas; não bloqueiam UI, bloqueiam regras finas APS |
| Risco | legado Java ainda não auditado RF a RF |

### Esforço por épico (pessoa-dias)

| Épico | Baixo | Provável | Alto | Notas |
|---|---:|---:|---:|---|
| E0 Design (externo) | 5 | 8 | 12 | Claude Design + ajustes |
| E1 Plataforma + manuais in-app | 12 | 18 | 25 | Inclui ajuda versionada |
| E2 Cadastros mestres | 10 | 15 | 22 | |
| E3 Cidadão/território | 12 | 18 | 28 | Unificação/duplicidade aumenta risco |
| E4 Agenda | 10 | 16 | 24 | |
| E5 Atendimento APS | 20 | 30 | 45 | Coração do MVP |
| E6 Vacinação | 10 | 15 | 22 | Regras etárias/lote |
| E7 Produção mínima | 8 | 14 | 22 | Stub → LEDI real sobe esforço |
| E8 Relatórios mínimos | 5 | 8 | 12 | |
| E9 Piloto / hardening | 8 | 12 | 18 | |
| **Subtotal implementação** | **95** | **146** | **218** | pessoa-dias |
| Buffer gestão/imprevistos 20% | 19 | 29 | 44 | |
| **Total** | **114** | **175** | **262** | pessoa-dias |

### Calendário (2 pessoas)

| Cenário | Pessoa-dias | Semanas corridas | Meses ≈ |
|---|---:|---:|---:|
| Otimista | 114 | ~7 | ~1,5–2 |
| **Provável (MVP)** | **175** | **~10–11** | **~2,5–3** |
| Pessimista | 262 | ~15–16 | ~4 |

> **Recomendação de planejamento:** comprometer **MVP em ~12 semanas (~3 meses)** com escopo congelado acima; qualquer inclusão (farmácia, lab, UPA, SAMU) empurra para fase 2.

### Custo de oportunidade

Se o time for **1 pessoa só**: multiplicar calendário por ~1,8–2,0 → MVP provável **~5–6 meses**.

---

## 5. Critérios de aceite do MVP

1. UBS piloto cadastra profissionais/equipes/pacientes e agenda consultas.
2. Realiza atendimento APS completo (abrir → registrar → finalizar) com histórico.
3. Registra vacina e emite cartão simples.
4. Usuário encontra ajuda in-app da tela em uso; TI acessa manual técnico.
5. Toda operação sensível aparece na auditoria.
6. Existe caminho versionado de exportação/produção (mesmo que em homologação).
7. Manuais publicados para 100% das telas MVP.

---

## 6. Ordem de trabalho imediata (próximos 15 dias)

1. Você envia o prompt ao **Claude Design** e devolve o pacote de UI.
2. Em paralelo aqui: decompilação P0 + specs `patient`, `appointment`, `encounter`, `vaccination`.
3. Congelar escopo MVP com a Secretaria (1 página de aceite).
4. Ao receber UI: implementar E1 → E2 → E3 (vertical slice) com manuais desde o dia 1.

---

## 7. Riscos principais

| Risco | Impacto | Mitigação |
|---|---|---|
| Escopo TR “vazar” para o MVP | Atraso severo | Freeze escrito; backlog fase 2 |
| Regras APS/LEDI complexas | Retrabalho | Specs e-SUS antes de fechar atendimento |
| Duplicidade de cidadãos | Dados ruins | Busca fonética/CPF/CNS no E3 |
| UI genérica demais | Retrabalho front | Prompt Design detalhado + review |
| Manuais esquecidos | Dívida / DoD quebrado | Checklist PR obrigatório |

---

## 8. Fase 2 (pós-MVP) — ordem sugerida

1. Odontologia  
2. Encaminhamento/regulação básica  
3. Farmácia dispensação  
4. Laboratório (pedido/resultado)  
5. Faturamento BPA/APAC  
6. Hospitalar/PA  
7. SAMU / TFD / PPI  
8. Portal/app cidadão  

Esforço fase 2 **não** está no total do MVP; estimar módulo a módulo após o piloto.
