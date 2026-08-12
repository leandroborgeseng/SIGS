# Gap analysis — TR Franca × e-SUS APS 5.5.24 × SGS

**Atualizado:** 2026-08-10  
**Premissa:** reescrever **primeiro** o que o e-SUS APS já faz; **depois** complementar lacunas municipais do TR.  
**Corte original (APS P0–P7):** Laboratorial (M6) e Transporte/TFD (M15) seguem fora do esforço APS inicial.  
**SAMU (M5):** **reativado** no backlog de reescrita com fonte `Samu/` — ver `docs/conhecimento/12-samu-fonte-federal-backlog.md` (stream S0–S4, paralelo ao APS).

Fontes: `RF-SGS-Franca-Anexo-I.md`, `docs/conhecimento/07-mapeamento-tr-vs-esus.md`, inventário/specs em `data/esus/5.5.24/`, pasta `Samu/`.

---

## 0. Tamanho do esforço (APS vs streams)

| Escopo | RF | Obrigatórios (aprox.) |
|---|---:|---:|
| TR completo (Anexo I) | **601** | ~530 |
| (−) Laboratorial + Transporte (ainda adiados) | **−114** | **−98** |
| **Backlog ativo APS + lacunas + SAMU** | **487** | **~432** |
| dos quais SAMU (stream S0–S4) | **30** | **~21** |

### Como o backlog se reparte

| Bucket | RF (aprox.) | Obrig. (aprox.) | Significado |
|---|---:|---:|---|
| Reescrita pura (forte e-SUS) | ~40 | ~40 | M10 + M12 |
| Reescrita + fatias de lacuna | ~153 | ~137 | M2 + M3 + M14 |
| Plataforma | ~50 | ~39 | M1 |
| Híbrido / complementar | ~97 | ~92 | M9, M13, M16–18 |
| Lacuna municipal **ainda no ativo** | ~117 | ~103 | Farmácia, hospitalar/UPA, PPI, contratualização |
| **SAMU (fonte `Samu/`)** | **30** | **~21** | Stream paralelo S0–S4 |
| **Subtotal ativo** | **~487** | **~432** | |
| Adiado (Lab+TFD) | 114 | 98 | Sem fonte equivalente ainda |

**Leitura rápida**

- Núcleo “reescrever APS + plataforma” (sem lacunas municipais restantes): ~**243 RF** (~216 obrig.).
- SAMU agora tem fonte e backlog próprio — **não** conta como P0–P7 APS.
- MVP 1 UBS (`plano-mvp.md`) continua sendo um **recorte** bem menor.

### Módulos adiados (podem voltar)

| # | Módulo | RF | Obr. | Motivo do adiamento |
|---|---|---:|---:|---|
| 6 | Laboratorial | 85 | 77 | LIS completo; APS só residual; sem fonte no monorepo |
| 15 | Transporte / TFD | 29 | 21 | Fora do e-SUS APS; sem fonte no monorepo |

### Módulo reativado

| # | Módulo | RF | Obr. | Fonte | Backlog |
|---|---|---:|---:|---|---|
| 5 | SAMU | 30 | 21 | `Samu/` (e-SUS SAMU WebForms + DLL) | stream S0–S4 — `docs/conhecimento/12-samu-fonte-federal-backlog.md` |

> Pedidos de exame **dentro** do ambulatorial (M3) e listagens de exame em cadastros (M2) **permanecem** no ativo — não são o módulo LIS.

---

## 1. Três camadas (não confundir)

| Camada | Pergunta | Situação hoje |
|---|---|---|
| **A. e-SUS APS** | O que o software federal já implementa (e vamos **reescrever**)? | Inventário + specs P0 — **não** é o SGS rodando |
| **B. Lacunas TR × e-SUS** | O que o TR exige e o e-SUS APS **não** cobre? | Ativo: lacunas municipais + **SAMU com fonte própria**; adiados Lab+TFD: 114 |
| **C. SGS (nosso produto)** | O que já está **implementado** no SGS? | Quase nada de produto final — pipeline, specs, OpenAPI, manuais iniciais |

---

## 2. Estratégia (com corte atual)

```text
Fase 1 — REESCRITA APS (+ plataforma mínima)
   Cadastros APS · território · agenda · atendimento · odonto · vacinação · LEDI
   + auth, auditoria, ajuda

Fase 2 — LACUNAS MUNICIPAIS (ainda no ativo)
   Farmácia/estoque · Hospitalar/UPA · PPI · Contratualização
   + fatias: totem/painel, AIH/APAC, estoque vacinal, portal, BI…

STREAM PARALELO — SAMU (fonte Samu/)
   S0 ocorrência/regulação → S1 frota/tempos → S2 relatórios → S3 integrações → S4 app

ADIADO (reativar quando houver fonte)
   Laboratorial/LIS · Transporte/TFD
```

MVP atual = recorte operacional da Fase 1 (1 UBS), não a reescrita 100% do e-SUS.

---

## 3. Visão por módulo

Legenda e-SUS: **forte** / **parcial** / **fraco** / **fora**.  
Coluna **Backlog:** `ativo` | `adiado`.

| # | Módulo | RF* | Fonte e-SUS | Backlog | Fase sugerida | Lacuna típica |
|---|---|---:|---|---|---|---|
| 1 | Especificações Gerais | 50 | fraco | ativo | Plataforma | Chat, Gov.br, 2FA |
| 2 | Cadastros | 61 | parcial | ativo | Reescrita + lacunas | Plantões, leitos, AIH/APAC |
| 3 | Ambulatorial | 73 | parcial | ativo | Reescrita + lacunas | Totem, painel, Glasgow, AIH |
| 4 | Contratualizações | 12 | fora | ativo | Lacuna | 100% TR |
| 5 | SAMU | 30 | fora (APS) / forte (`Samu/`) | **ativo (stream S*)** | S0–S4 | App embarcado, SMS, enfermagem USA |
| 6 | Laboratorial | 85 | fraco | **adiado** | — | Reativar depois (LIS) |
| 7 | Farmácia | 45 | fraco | ativo | Lacuna | Estoque/CAF |
| 8 | Hospitalar e PA | 52 | fraco | ativo | Lacuna | Internação, UPA, leitos |
| 9 | Faturamento | 7 | fraco | ativo | Híbrido | BPA/APAC/AIH além LEDI |
| 10 | Integração e-SUS | 20 | forte | ativo | Reescrita | Conformidade federal |
| 11 | PPI | 8 | fora | ativo | Lacuna | 100% TR |
| 12 | Odontologia | 20 | forte | ativo | Reescrita | Poucas (detalhar RF) |
| 13 | Regulação | 23 | fraco | ativo | Híbrido | Portal/fila, WhatsApp |
| 14 | Vacinação | 19 | forte | ativo | Reescrita + lacunas | Estoque / rede de frio |
| 15 | Transporte / TFD | 29 | fora | **adiado** | — | Reativar depois |
| 16 | Análises | 23 | parcial | ativo | Híbrido | BI municipal |
| 17 | Apps e Transparência | 35 | fraco | ativo | Híbrido | Portal cidadão |
| 18 | Vigilância | 9 | parcial | ativo | Híbrido | RAAT, receituário especial |

\*Contagens oficiais do Anexo I (total **601**).

---

## 4. O que o e-SUS APS já cobre (alvo da reescrita)

| Domínio | Evidência SGS | Status spec |
|---|---|---|
| Cidadão / paciente | `spec/patient` | ✅ |
| Agenda | `spec/appointment` | ✅ |
| Atendimento / ficha individual | `spec/encounter` + LEDI AI | ✅ |
| Vacinação | `spec/vaccination` + LEDI vacina | ✅ |
| Unidade / profissional / equipe | `spec/organization` + OpenAPI | ✅ |
| Território / domicílio / ACS | hits fortes | ⏳ |
| Odontologia / AD / coletivo | JARs presentes | ⏳ |
| LEDI / produção APS | thrift + mappers | ✅ parcial |
| CadSUS / sync / unificação | JARs P0 | ⏳ |

---

## 5. Lacunas no backlog ativo (sem Lab/TFD; SAMU em stream próprio)

### 5.1 Lacuna municipal ainda no ativo (~117 RF)

| Bloco | RF | Nota |
|---|---:|---|
| Contratualizações | 12 | 100% TR |
| Farmácia (estoque/CAF) | 45 | Prescrição APS ≠ farmácia |
| Hospitalar / PA / UPA | 52 | Fora do núcleo APS |
| PPI | 8 | Pactuação |

### 5.2 Fatias dentro de módulos de reescrita (exemplos)

| Módulo | Exemplos |
|---|---|
| Cadastros / Ambulatorial | Totem, painel, Glasgow, AIH/APAC, plantões, leitos |
| Vacinação | Estoque em salas |
| Regulação / Apps / Vigilância | Portal, WhatsApp, RAAT, receituário especial |
| Gerais | Chat, Gov.br |

### 5.3 Adiado (não conta no esforço inicial)

Laboratorial (85) + Transporte/TFD (29) = **114 RF** ainda adiados.  
SAMU (30) = **reativado** (backlog S0–S4).

---

## 6. O que o SGS já tem vs “implementado”

| Item | Status |
|---|---|
| Pipeline engenharia reversa e-SUS | ✅ |
| Specs domínio P0 + OpenAPI MVP | ✅ |
| Manuais (política + central ajuda) | ✅ parcial |
| UI / app rodando | ❌ |
| Backend de domínio em produção | ❌ |

---

## 7. Próximos passos

1. Tratar **457 RF** como teto do esforço inicial (TR menos 3 módulos).
2. Priorizar ~**243 RF** de plataforma + reescrita APS antes das lacunas municipais restantes (~117).
3. Planilha RF-a-RF só no backlog **ativo**.
4. Reativar M5/M6/M15 quando a Secretaria priorizar.

Painel: canvas `tr-esus-lacunas`.

---

## 8. Aviso de confiança

Cobertura por módulo = **STRONG_INFERENCE**. Contagem exata fecha com planilha RF-a-RF. Comportamento e-SUS ≠ norma legal automática.
