# SAMU federal — inventário da fonte e backlog de reescrita

**Atualizado:** 2026-08-10  
**Decisão:** o módulo SAMU (TR M5 / RF-5.1–5.30), antes **adiado**, entra no **backlog de reescrita** do SIGS com fonte própria (não e-SUS APS).  
**Regra:** specs tecnologicamente neutras → implementação Nest/Prisma própria. **Não** copiar ASPX/VB/DLL.

---

## 1. Fonte disponível no repositório

| Item | Valor |
|---|---|
| Pasta | `Samu/` (raiz do monorepo) |
| Produto legado | **e-SUS SAMU** (WebForms ASP.NET / VB.NET) |
| Projeto | `Samu/Samu_2012.vbproj` · assembly `esus-samu` |
| Runtime alvo | .NET Framework **4.5** |
| Telas | ~**110** `.aspx` |
| Lógica | majoritariamente em **`Samu/bin/esus-samu.dll`** (code-behind compilado; poucos `.vb` soltos) |
| Banco (config) | SQL Server · catalog `samu_sorocaba` · log `esussamu_log` |
| Município no `web.config` | Sorocaba / IBGE `355220` / UF `35` (instância de referência; **não** é Franca) |

> **Segurança:** `Samu/web.config` contém connection string com credenciais de exemplo. Não reutilizar em produção; preferir secrets locais / `.env` fora do git.

### 1.1 Estrutura funcional observada

```text
Samu/
├── Login / Account / Site.Master          → autenticação Forms
├── Default_Atendimento / frm_*            → fluxo TARM / regulação / ocorrência
├── Default_Frota / frm_Frota* / ro_*      → frota, bases, equipes, veículos
├── Administrativo/                        → cadastros (motivo, tipo, veículo, perfil…)
├── Monitoramento/                         → painéis (monitor, posição ocorrência)
├── Relatorios/                            → R1…R10 (chamadas, tempos, motivos)
├── Busca_End.ashx / Busca_HD.ashx          → handlers SQL (endereço / HD)
└── bin/esus-samu.dll                      → regras + acesso a dados
```

### 1.2 Domínio / operações detectadas (DLL + telas)

| Conceito | Evidência | Entidade SIGS alvo (neutra) |
|---|---|---|
| Ocorrência / chamado | `tb_Ocorrencia`, `Reg_Ocorrencia`, `INICIA_OCORRENCIA` | `SamuIncident` / `Call` |
| Solicitante | `frm_Solicitante`, `Solicitante_Grava` | `Caller` |
| Paciente / vítima | `frm_Paciente`, `saidas_Vitima_Ocorrencia` | vínculo a `Patient` municipal |
| Avaliação estruturada / não estruturada | `frm_Avaliacao_*`, `tb_avaliacao` | `ClinicalAssessment` |
| Conduta / decisão técnica | `frm_Conduta`, `tb_decisao_tecnica`, `decisao-tecnica.aspx` | `RegulatorDecision` |
| Classificação de risco | `chk_classificarisco`, `classificacao-paciente` | `TriageColor` |
| Frota / veículo | `frm_Frota*`, `tb_veiculoLivre|Ocupado|Patio` | `Ambulance` / `FleetUnit` |
| Tempos operacionais | `EQUIPE_SAI_BASE`, `CHEGA_LOCAL`, `SAI_LOCAL`, `CHEGA_DESTINO`, `LIBERA` | `OperationalTimeline` |
| Equipe / base / profissional | `ro_Cadastro_*`, `ro_Monta_Equipe` | `SamuTeam` / `Base` |
| Monitor | `Monitoramento/monitor.aspx` | painel tempo real |
| Relatórios | `R1ChamadasRecebidas` … `R10Motivo` | reports RF-5.27/5.28 |
| Endereço / mapa | `Busca_End.ashx`, `LOGRADOUROS`, modais de posição | geocoding + mapa |

Ciclo operacional típico (legado):

```text
Ligação / TARM
  → Solicitante + endereço + motivo/tipo
  → Ocorrência (número)
  → Avaliação (estruturada | livre)
  → Decisão regulador (orientação | despacho)
  → Solicitação de veículo / vínculo frota
  → Tempos: sai base → chega local → sai local → chega destino → libera
  → Conclusão / reclassificação / desfecho
  → Relatórios / estatísticas
```

---

## 2. Mapeamento TR Franca (RF-5) × fonte SAMU

| RF | Tipo | Cobertura na fonte `Samu/` | Onda backlog |
|---|---|---|---|
| RF-5.1 | Obr | Bases/unidades (`ro_Cadastro_Base`, unidades destino) | S1 |
| RF-5.2 | Obr | Plantão — parcial / a confirmar no DLL | S2 |
| RF-5.3–5.4 | Obr | Fichas/campos — avaliação estruturada + administrativa | S2 |
| RF-5.5–5.6 | Obr | Equipes / montagem (`ro_Cadastro_Equipe`, `ro_Monta_Equipe`) | S1 |
| RF-5.7 | Obr | Registro completo ocorrência (`frm_Solicitante`→paciente→frota) | **S0** |
| RF-5.8 | Obr | Endereço + posição (`Busca_End`, modais mapa) | S1 |
| RF-5.9 | Des | SMS link — **não evidenciado** na pasta | S4 / TR |
| RF-5.10 | Des | Dados clínicos em viagem — parcial (avaliação) | S3 |
| RF-5.11 | Obr | Procedimentos em trânsito — a extrair do DLL | S2 |
| RF-5.12 | Des | Situações do atendimento (status frota/ocorrência) | S1 |
| RF-5.13 | Obr | Encerramento (`frm_Conclusao`) | **S0** |
| RF-5.14 | Obr | Agendamento transporte eletivo — parcial | S3 |
| RF-5.15–5.16 | Obr | Monitores (`Monitoramento/`, `frm_Controle_*`) | **S0**/S1 |
| RF-5.17 | Obr | Transporte eletivo monitor — parcial | S3 |
| RF-5.18 | Des | Mapa tempo real painel — parcial (posição) | S3 |
| RF-5.19 | Obr | Paciente → reusar `Patient` municipal SIGS | S1 |
| RF-5.20–5.23 | Des | App embarcado / offline / checklist — **fora desta pasta** | S4 |
| RF-5.24 | Obr | Painel leitos regulador — **gap** (cruzar Hospitalar/PA) | S3 |
| RF-5.25 | Obr | Decisão regulador + cores + CID + veículo | **S0** |
| RF-5.26 | Obr | Reclassificação no encerramento | S1 |
| RF-5.27–5.28 | Obr | Chamados por desfecho + relatórios R1–R10 | S2 |
| RF-5.29 | Obr | Tempos operacionais na central | S1 |
| RF-5.30 | Des | Processo enfermagem USA — **não evidenciado** | S4 / TR |

---

## 3. Backlog de implementação (ondas)

> SAMU **não** entra no P0–P7 APS. Stream paralelo **S0–S4**, após (ou em paralelo controlado com) núcleo APS + produção LEDI estável.

### S0 — Núcleo regulação / ocorrência (MVP SAMU)

1. Spec neutra `data/samu/spec/` (entities, workflows, validations) a partir de telas + strings do DLL.  
2. Modelo Prisma: ocorrência, solicitante, vítima↔paciente, decisão, status, vínculo veículo.  
3. API Nest: abrir chamado → avaliar → decidir (orientação/despacho) → encerrar.  
4. UI MVP: fila/monitor mínimo + ficha de ocorrência.  
5. Matriz RF-5.7 / 5.13 / 5.15 / 5.25 + auditoria.

### S1 — Frota, tempos, cadastros e mapa

6. Cadastros: base, tipo veículo, veículo, equipe, motivos, tipos ocorrência, origem ligação.  
7. Timeline operacional (6 tempos mínimos).  
8. Busca endereço (portar comportamento de `Busca_End`, sem SQL legado).  
9. Paciente unificado com cadastro municipal (RF-5.19).  
10. RF-5.1, 5.5, 5.8, 5.12, 5.26, 5.29.

### S2 — Relatórios, plantão, procedimentos

11. Relatórios gerenciais (espelho R1–R10).  
12. Plantões / escalas (RF-5.2, 5.6).  
13. Procedimentos em trânsito (RF-5.11).  
14. Estatísticas por desfecho (RF-5.27–5.28).

### S3 — Integrações municipais

15. Painel de leitos (cruzar M8 Hospitalar/PA — RF-5.24).  
16. Transporte eletivo (RF-5.14, 5.17).  
17. Mapa/painel TV (RF-5.18).  
18. Fichas clínicas em viagem (RF-5.10).

### S4 — App embarcado e desejáveis sem evidência na pasta

19. App offline ambulância (RF-5.20–5.23) — fonte a obter separadamente.  
20. SMS localização (RF-5.9).  
21. Processo de enfermagem USA (RF-5.30).

---

## 4. Trabalho analítico imediato (antes de codar S0)

| # | Tarefa | Saída |
|---|---|---|
| A1 | Decompilar `Samu/bin/esus-samu.dll` → `data/samu/decompiled/` | **feito** |
| A2 | Extrair modelo via SQL do DLL → `data/samu/analysis/data-model.md` | **feito** (DDL SQL Server ainda desejável) |
| A3 | Context pack `contexts/samu/` (telas → RF → entidades) | pendente ao retomar |
| A4 | Atualizar CSV RF-5.* de `adiado` → `não iniciado` | **feito** |
| A5 | **Não** evoluir `Samu/` in-place — só ler | regra permanente |

---

## 5. Relação com a estratégia fase 1

- Documento de corte antigo: SAMU fora do esforço **APS inicial** — mantido para P0–P7.  
- **Novo:** SAMU tem **fonte federal/municipal** e entra no backlog de reescrita como stream **S\***.  
- LIS (M6) e TFD (M15) continuam adiados até haver fonte equivalente.

---

## 6. DoD de uma fatia SAMU (igual APS)

1. Código Nest + testes  
2. Entrada na matriz RF (Obr/Des + fonte `TR` + `Samu/`)  
3. Manual técnico  
4. Manual usuário (stub se UI pendente)  
5. Sem dados reais de pacientes; sem senhas do `web.config` em docs

---

## 7. Achados da decompilação (2026-08-10)

- Saída: `data/samu/decompiled/raw/esus-samu/`  
- Modelo: `data/samu/analysis/data-model.md`  
- Síntese: `docs/conhecimento/13-samu-o-que-vamos-enfrentar.md`  

**Conclusão:** S0 viável sem app; priorizar máquina de estados ocorrência + frota; obter DDL SQL quando possível.

A1 e A2 (decompilar + data-model) estão **feitos**. Restam A3 (context pack) quando retomar o stream.
