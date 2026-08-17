# Mapa de cruzamentos entre fichas LEDI/CDS

**Registrado:** 2026-08-16  
**Escopo:** tipos **2, 3, 4, 5, 6, 7, 8, 10, 14** + header CNES/INE/CNS/CBO.  
**Foco:** faturamento (Siaps) + qualidade Previne/SISAB.  
**Não implementa** validators novos — especifica cruzamentos e códigos de finding sugeridos para o funil pré-envio.

**Fontes:** [mvp-correcao-dados-aps.md](mvp-correcao-dados-aps.md) · [15-faturamento-indicadores…](../conhecimento/15-faturamento-indicadores-campos-obrigatorios.md) · [14-indicadores…](../conhecimento/14-indicadores-aps-previne-brasil.md) · [16-tres-tipos…](../conhecimento/16-tres-tipos-ficha-ledi-franca.md) · `ledi-cds-common` · `ledi-error-registry` · audit CNES/faturamento · FieldHint RF-2.30.

---

## 1. Modelo mental

```text
                    ┌─────────────────────────────┐
                    │  Cadastro mestre municipal  │
                    │  CNES · PF · INE · CBO      │
                    └─────────────┬───────────────┘
                                  │ header de toda produção
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
   ┌──────────┐            ┌─────────────┐          ┌────────────┐
   │ Tipo 2   │◄──CNS/CPF──│ Produção    │──INE────►│ Tipo 3     │
   │ Cad. Ind.│            │ 4 FAI       │          │ Domicílio  │
   │ (pessoa) │◄───────────│ 5 FAO       │          │ (território│
   └────┬─────┘            │ 6 Coletivo  │          │  família)  │
        │ vínculo NT 30    │ 7 PROC      │          └─────┬──────┘
        │ paciente↔equipe  │ 8 Visita    │◄──uuid/dom─────┘
        ▼                  │10 AD        │
   denominador Previne     │14 Vacina    │
   C*/B*/M*/CR*            └─────────────┘
```

| Camada | Fichas | Papel |
|---|---|---|
| **Pessoa** | **2** Cadastro Individual | Identidade + atributos CDS; base do denominador |
| **Território** | **3** Domiciliar · **8** Visita ACS | Imóvel/família/microárea; VD para scores C2–C6 |
| **Produção clínica** | **4** FAI · **5** FAO · **7** PROC · **10** AD · **14** Vacina · **6** Coletivo | Numeradores Siaps + Previne |
| **Rede** | Header em todas | CNES + INE + CNS prof + CBO — elegibilidade e glosa |

### Resposta direta: FAO ⇒ cadastro individual?

**Não.** A FAO (5) traz `cnsCidadao` / `cpfCidadao` + `stNaoPossuiCpf` **na própria ficha**. O Siaps pode aceitar produção **sem** ficha tipo **2** no mesmo ZIP.

| Pergunta | Siaps (eixo A) | Previne (eixo B) |
|---|---|---|
| Pessoa da FAO precisa existir no tipo 2? | Não obrigatório no XML de produção | **Sim na prática** — denominador “vinculados” (NT 30) e completude CDS |
| Cadastro individual “completo”? | ID mínimo (nome/DN/sexo/mãe + CPF\|CNS) | + nacionalidade/raça/etnia/deficiência/NIS + vínculo equipe + condições |

No SIGS: Paciente Mestre (`/pacientes` + match) é o **destino local** do tipo 2; produção nativa resolve paciente antes do finish — o gap é cruzar **ZIP de terceiros** e lotes 2/3/6/8/10/14 ainda sem wizard.

---

## 2. Matriz de cruzamentos

Severidade: **BLOCKER** = Siaps/envio · **MONEY_RISK** = Previne/financiamento · **QUALITY** = qualidade/auditoria.  
**Já existe?** = código/regra no SIGS hoje (parcial = mesmo eixo, outro alvo).

| # | Origem | Destino / mestre | Chave | O que validar | Sev. | Autofix? | Já existe? |
|---|---|---|---|---|---|---|---|
| H1 | Qualquer produção | CNES municipal | `cnes` 7 dig | CNES na rede Prefeitura (gestão 1244), ativo | MONEY_RISK | Não (corrigir origem/CNES) | Sim — `CNES_NOT_IN_MUNICIPAL_NETWORK` · audit `CNES_NOT_IN_MUNICIPIO` / `CNES_INACTIVE` |
| H2 | Qualquer produção | PF / lotação | `profissionalCNS` + CBO + CNES | CNS lotado na unidade; CBO coerente com lotação | BLOCKER / MONEY_RISK | Semi (sugerir lotação) | Sim — `CNS_NOT_IN_MUNICIPAL_CNES` · `CNS_NOT_LINKED` · `CBO_MISMATCH` |
| H3 | Qualquer produção | Equipe CNES | `ine` | INE existe, pertence ao CNES, equipe com membros | MONEY_RISK / QUALITY | Não | Parcial — `INE_MISSING` · `INE_NOT_IN_CNES_TEAM` · `INE_CNES_MISMATCH` · `TEAM_WITHOUT_MEMBERS` · `LEDI_CNES_INE_ALERT` |
| H4 | Qualquer produção | Header comum | UUID, `tpCdsOrigem`, IBGE, data | Envelope LEDI válido | BLOCKER / MONEY_RISK | Parcial (UUID case/length, stNaoPossuiCpf) | Sim — `ledi-cds-common` / registry |
| H5 | Multi-equipe | PF | CNS × N INEs | Lotação sem INE; profissional em ≥2 equipes sem escolha clara | MONEY_RISK | Não | Parcial — `ASSIGNMENT_INE_MISSING` · UI multi-equipe |
| **P×2** | **4/5/7/6/8/10/14** | **Cad. Individual (2)** | CNS ou CPF | Cidadão da produção existe no mestre / tipo 2 | MONEY_RISK | Não (criar/vincular cadastro) | **Não** (só Paciente Mestre em migrate nativo) |
| P×2b | Produção | Tipo 2 | CNS/CPF + DN | Identidade coerente (sexo/DN vs gestante/idade) | QUALITY / MONEY_RISK | Semi | Parcial — `GESTANTE_SEXO_MASC` · `DT_NASCIMENTO_*` (intra-ficha) |
| P×2c | Produção | Tipo 2 + vínculo | CNS/CPF → INE | Pessoa vinculada à equipe do header (NT 30) | MONEY_RISK | Não | **Sim** — `PRODUCAO_SEM_VINCULO_EQUIPE` · `PRODUCAO_INE_NEQ_VINCULO` (audit + cobertura honesta) |
| **2×3** | Cad. Individual (2) | Domicílio (3) | CNS/CPF · uuid família/membro | Pessoa é membro/responsável de domicílio ativo na microárea | MONEY_RISK (C2–C6) | Não | Domínio UI `/territorio`; **sem** cruzamento LEDI |
| 2×3b | Tipo 2 | Tipo 3 | responsável familiar | Todo domicílio com responsável válido no tipo 2 | BLOCKER (CDS) / QUALITY | Não | Validação serviço household; sem ZIP tipo 3 |
| **8×3×2** | Visita ACS (8) | Dom. (3) + Ind. (2) | patientId / household · CNS | Visita aponta paciente **e/ou** domicílio existentes; motivos/desfecho | BLOCKER CDS / MONEY_RISK Previne | Não | Domínio + FieldHint; lote **stub** |
| 8×VD | Visita (8) | Ind. (2) + condições | CNS + datas | ≥2 VD intervalo ≥30d (C4/C5/C6); 1ª ≤30d (C2); gestante (C3) | MONEY_RISK | Não | **Não** (motor Previne ausente) |
| **5×2** | FAO (5) | Ind. (2) | CNS/CPF | Pessoa contável + vínculo eSB/eSF | MONEY_RISK B* | Não | Não (cruzamento) |
| 5×cond | FAO | Ind. / CIAP-CID | `problemasCondicoes` | ≥1 CIAP/CID; gestante (C3.K / bucal gestante) | BLOCKER + MONEY_RISK | Semi (CIAP genérico perigoso) | Sim intra-FAO — `PROBLEMAS_MISSING` · `PREVINE_*` · `GESTANTE_*` |
| 5×B | FAO | Catálogo SIGTAP/B* | procs + conduta 15 + tipo consulta | B1 015-3 · B2 conclusão · B3–B6 mix · **não** B4 | MONEY_RISK | Semi (procs) | Sim x-ray — `PREVINE_B1_*`…`B6_*` · `PREVINE_B4_NOT_IN_FAO` |
| **4×2** | FAI (4) | Ind. (2) | CNS/CPF | Pessoa + DN/sexo | MONEY_RISK C* | Não | Não (cruzamento) |
| 4×INE | FAI | Equipe | INE header | INE preenchido (~31% faltava Franca) | MONEY_RISK | Semi se lotação | `INE_MISSING` (QUALITY default; gate nativo pode BLOCKER) |
| 4×C | FAI | Cond. clínicas | CIAP/CID + tipo demanda + antro/PA | C1 demanda; C3–C5 condições; C2/C6 antro | MONEY_RISK | Não (clínico) | Parcial — `PROBLEMAS_MISSING` FAI · FieldHint Previne |
| **7×2** | PROC (7) | Ind. (2) | CNS/CPF | Pessoa identificada | MONEY_RISK | Não | Não (cruzamento) |
| 7×SIGTAP | PROC | Catálogo | código 10 dig | Rejeitar ABPG; SIGTAP ativo/competência | BLOCKER / MONEY_RISK | Semi mapa ABPG→SIGTAP | Sim — `PROC_CODE_ABPG` · audit `SIGTAP_*` |
| **6×2** | Coletivo (6) | Participantes → Ind. (2) | lista CNS/CPF | Cada participante existe + idade 6–12 p/ B4 | MONEY_RISK B4 / M* | Não | Domínio `/coletivo`; **sem** ZIP; B4 fora FAO |
| 6×SIGTAP | Coletivo | Proc B4 | `01.01.02.003-1` | Escovação supervisionada no coletivo (não na FAO) | MONEY_RISK | Não | FieldHint Previne coletivo |
| **10×2** | AD (10) | Ind. (2) | CNS/CPF (N cidadãos) | Cidadãos ≥1 existem; continuidade AD1/2/3 | BLOCKER / QUALITY | Não | Preflight AD; lote stub |
| 10×cond | AD | CIAP/CID | problemas | Qualidade clínica AD | QUALITY | Não | `AD_PROBLEMAS_MISSING` (preflight) |
| **14×2** | Vacina (14) | Ind. (2) | CNS/CPF + DN | Pessoa + idade coerente com faixa PNI | MONEY_RISK C2/C3/C6/C7 | Não | Domínio vacina; **sem** ZIP 14 |
| 14×faixa | Vacina | Catálogo faixa | imuno + dose + idade | Faixa oficial (`TB_FAIXA` quando houver dump) | MONEY_RISK / BLOCKER local | Não | Seed 54 ≠ dump (`officialDumpPresent=false`) |
| **2 completo** | Tipo 2 | Siaps vs Previne | campos CDS | Ver §3 | BLOCKER ID / MONEY_RISK CDS | Semi ID | **Sim** na auditoria — `CADASTRO_INCOMPLETO_SIAPS` · `CADASTRO_INCOMPLETO_PREVINE` (FieldHint); lote tipo 2 ainda sintético |
| Dup | Qualquer | Paciente Mestre | CNS/CPF/DN | Duplicata HIGH/MEDIUM | MONEY_RISK | Semi unificação | Match A1–A2; UX MEDIUM parcial |

---

## 3. “Cadastro individual completo” — checklist

### 3.1 Siaps / envio (mínimo de pessoa)

| Campo | Obrigatório | Nota |
|---|---|---|
| Nome civil | Sim | |
| Data nascimento | Sim | Cruzar com idade vacina/idoso |
| Sexo | Sim | Gestante |
| Nome mãe **ou** “Desconhece” | Sim | |
| CPF **ou** CNS válido | Sim | Exclusão mútua + `stNaoPossuiCpf` nas fichas de produção |
| Óbito (se falecido) | Condicional | Data/certidão |

Sem isso: pessoa **não contável** de forma confiável (BLOCKER nas fichas de produção que carregam o ID).

### 3.2 Previne / CDS (RF-2.30 + denominador)

| Campo / vínculo | Por quê | Ind. típicos |
|---|---|---|
| Nacionalidade (+ IBGE nasc. se BR) | Qualidade CDS | Denominador geral |
| Raça/cor · etnia | Equidade / CDS | — |
| Deficiência | CDS | — |
| NIS | CDS / programas | — |
| Escolaridade / e-mail | Completude local (neutro UI) | — |
| **Vínculo paciente↔equipe (INE)** + microárea | NT 30 — denominador | Quase todos C*/B*/M* |
| Membro de domicílio (tipo 3) | Território / VD | C2–C6 |
| Condições ativas (gestação, DM, HAS, TB…) | Abrir scores | C3–C5, CR* |
| Sem duplicata no Paciente Mestre | Evita numerador duplo | Todos |

**Completo Siaps ≠ completo Previne.** UI: vermelho Siaps vs laranja Previne (`docs/manuais/campos-siaps-previne.md`).

---

## 4. Prioridade de implementação (funil pré-envio)

| Pri | Cruzamento | Motivo |
|---|---|---|
| **P0** | Header × CNES/PF/INE (H1–H5) | Já parcial; fechar gate finish + audit |
| **P0** | Produção 4/5/7 × identidade (`stNaoPossuiCpf`, CNS/CPF) | BLOCKER Franca 100% |
| **P0** | FAO × CIAP/CID + INE | BLOCKER + B* |
| **P1** | Produção × Cadastro Individual / Paciente Mestre (P×2) | “FAO sem cadastro” = MONEY_RISK Previne |
| **P1** | Produção × vínculo NT 30 (P×2c) | Denominador |
| **P1** | PROC × SIGTAP (ABPG) | 210 fichas Franca |
| **P1** | FAO × Previne B1–B6 (já x-ray) → painel fechamento | Dinheiro bucal |
| **P1** | Completude tipo 2 (Siaps vs Previne) | Lote 2 quando existir |
| **P2** | 8 × 3 × 2 (VD) | C2–C6; depende amostra ZIP |
| **P2** | 6 × participantes × B4 | Escovação fora da FAO |
| **P2** | 14 × idade/faixa | C2/C3/C6/C7; TB_FAIXA |
| **P2** | 10 × continuidade AD | Qualidade AD |
| **P2** | 2 × 3 território | Microárea/família |
| **P2** | eSB↔eSF + 20h | B1/B4 ÷2 |

Ordem prática alinhada ao MVP roadmap 1–8: **rede → identidade → mestre pessoa → SIGTAP/Previne bucal → CDS/vacina/coletivo**.

---

## 5. Achados sugeridos (novos)

Prefixo: origem × destino. Não colidir com registry atual (`PROBLEMAS_MISSING`, `CNS_NOT_IN_MUNICIPAL_CNES`, `PREVINE_B*`, …).

| Código sugerido | Sev. | Cruzamento |
|---|---|---|
| `FAO_CNS_NOT_IN_CADASTRO_INDIVIDUAL` | MONEY_RISK | 5 → 2 |
| `FAI_CNS_NOT_IN_CADASTRO_INDIVIDUAL` | MONEY_RISK | 4 → 2 |
| `PROC_CNS_NOT_IN_CADASTRO_INDIVIDUAL` | MONEY_RISK | 7 → 2 |
| `VACINA_CNS_NOT_IN_CADASTRO_INDIVIDUAL` | MONEY_RISK | 14 → 2 |
| `AD_CNS_NOT_IN_CADASTRO_INDIVIDUAL` | MONEY_RISK | 10 → 2 |
| `COLETIVO_PARTICIPANTE_NOT_IN_CADASTRO` | MONEY_RISK | 6 → 2 |
| `VISITA_CNS_NOT_IN_CADASTRO_INDIVIDUAL` | MONEY_RISK | 8 → 2 |
| `VISITA_HOUSEHOLD_NOT_FOUND` | BLOCKER/QUALITY | 8 → 3 |
| `CADASTRO_SEM_DOMICILIO` | MONEY_RISK | 2 → 3 |
| `DOMICILIO_RESPONSAVEL_NOT_IN_CADASTRO` | BLOCKER | 3 → 2 |
| `PRODUCAO_SEM_VINCULO_EQUIPE` | MONEY_RISK | * → NT 30 |
| `PRODUCAO_INE_NEQ_VINCULO` | MONEY_RISK | header INE ≠ vínculo ativo |
| `CADASTRO_INCOMPLETO_SIAPS` | BLOCKER | tipo 2 ID mínimo |
| `CADASTRO_INCOMPLETO_PREVINE` | MONEY_RISK | tipo 2 CDS RF-2.30 |
| `CADASTRO_SEM_CONDICAO_CLINICA` | MONEY_RISK | 2 sem CIAP/CID de elegibilidade quando produção tem | 
| `INE_FANTASMA` | MONEY_RISK | INE sem membros / fora CNES |
| `MULTI_EQUIPE_INE_AMBIGUO` | MONEY_RISK | PF multi-equipe sem INE no header |
| `VACINA_IDADE_FORA_FAIXA` | MONEY_RISK | 14 × DN |
| `COLETIVO_B4_SEM_FAIXA_6_12` | MONEY_RISK | B4 idade |
| `ESB_SEM_ESF_REFERENCIA` | MONEY_RISK | B1/B4 denom |

**Reusar (já no SIGS):** `ST_NAO_POSSUI_CPF`, `PROBLEMAS_MISSING`, `PROC_CODE_ABPG`, `CNS_NOT_IN_MUNICIPAL_CNES`, `CNES_NOT_IN_MUNICIPAL_NETWORK`, `INE_*`, `PREVINE_B1_*`…`B6_*`, `PREVINE_B4_NOT_IN_FAO`, `TEAM_WITHOUT_MEMBERS`, `PATIENT_TEAM_LINK_ORPHAN`, `ASSIGNMENT_INE_MISSING`.

---

## 6. Âncoras de código

| Tema | Path |
|---|---|
| Header + rede municipal | `apps/api/src/care-extra/ledi-cds-common.ts` |
| Registry FAO/FAI/PROC | `apps/api/src/care-extra/ledi-error-registry.ts` |
| Previne bucal x-ray | `apps/api/src/care-extra/ledi-fao-previne-xray.ts` |
| Audit produção | `apps/api/src/faturamento/faturamento-audit.service.ts` |
| Vínculo NT 30 (P×2c) | `apps/api/src/care-extra/ledi-vinculo-nt30.ts` |
| Completude tipo 2 | `apps/api/src/care-extra/ledi-cadastro-completude.ts` |
| Audit CNES/equipes | `apps/api/src/cnes/cnes-audit.service.ts` |
| Detector tipos | `apps/api/src/care-extra/ledi-ficha-tipo.ts` |

---

## 7. Mensagem operacional

1. **Aceite Siaps** valida a ficha **isolada** (e header contra CNES).  
2. **Financiamento Previne** exige **grafo**: pessoa (2) ↔ equipe ↔ domicílio (3) ↔ produção (4/5/6/7/8/10/14).  
3. Corrigir só `stNaoPossuiCpf` + CIAP na FAO **abre a porta**; sem cadastro/vínculo/SIGTAP certo o indicador continua baixo.
