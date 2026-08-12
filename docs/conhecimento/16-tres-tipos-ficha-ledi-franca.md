# Três tipos de ficha LEDI do dump Franca (5974691)

**Atualizado:** 2026-08-12  
**Objetivo:** saber **qual XML é qual** e **onde corrigir** no SIGS.

---

## Como identificar (sempre)

No envelope `dadoTransporteTransportXml`:

| Campo / tag | Tipo |
|---|---|
| `tipoDadoSerializado` = **4** · `fichaAtendimentoIndividualMasterTransport` | **FAI** — Atendimento Individual |
| `tipoDadoSerializado` = **5** · `fichaAtendimentoOdontologicoMasterTransport` | **FAO** — Atendimento Odontológico |
| `tipoDadoSerializado` = **7** · `fichaProcedimentoMasterTransport` | **Procedimentos** |

Pelo nome do arquivo (legado):

| Prefixo do arquivo | Tipo |
|---|---|
| `cadastroatendimentoindividual-*.esus.xml` | FAI (4) |
| `atendimentoodontologico-*.esus.xml` | FAO (5) |
| `cadastroprocedimentos-*.esus.xml` | Procedimentos (7) |

---

## Onde corrigir cada uma

| Tipo | Pasta típica | Qtd (dump) | Tela / fluxo SIGS | Correções prioritárias |
|---|---|---:|---|---|
| **FAO (5)** | `Downloads/5974691` | 1131 | **`/odonto/lote`** (única com validador+raio-x hoje) | `stNaoPossuiCpf`, `PROBLEMAS_MISSING` (CIAP/CID), INE, Previne B1–B6 |
| **FAI (4)** | `Downloads/sistemas/5974691` | 8149 | Ainda **não** há lote FAI na UI — não misturar com odonto | `stNaoPossuiCpf`, CNES 7 dígitos, `turno` 1–3, INE |
| **Procedimentos (7)** | `Downloads/sistemas 2/5974691` | 2675 | Ainda **não** há lote procedimentos na UI | `stNaoPossuiCpf`, códigos SIGTAP (evitar `ABPGxxx`) |

### Regra de ouro

- **Saúde bucal / Previne B1–B6 / RNDS odonto** → só **FAO (5)** em `/odonto/lote`.
- Subir FAI ou Procedimentos nessa tela gera alerta de **tipo errado** (não é FAO).
- FAI e Procedimentos compartilham o blocker universal `stNaoPossuiCpf` — a correção é parecida, mas o **validador e o painel** de odonto não se aplicam.

---

## Relatório detalhado por lote

- FAO → `docs/conhecimento/analise-lote-fao-5974691.md`
- FAI → `docs/conhecimento/analise-lote-fai-5974691.md`
- Procedimentos → `docs/conhecimento/analise-lote-procedimentos-5974691.md`

---

## Próximo passo de produto

1. Manter `/odonto/lote` focado em **FAO**.  
2. Exibir tipo detectado em cada arquivo (e filtrar).  
3. Depois: lote FAI e lote Procedimentos no mesmo padrão (gráficos + correção em massa).
