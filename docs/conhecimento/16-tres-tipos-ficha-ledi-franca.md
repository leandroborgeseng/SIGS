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
| **FAO (5)** | `Downloads/5974691` | 1131 | **`/odonto/lote`** | `stNaoPossuiCpf`, `PROBLEMAS_MISSING` (CIAP/CID), INE, Previne B1–B6 |
| **FAI (4)** | `Downloads/sistemas/5974691` | 8149 | **`/aps/lote`** | `stNaoPossuiCpf`, CNES 7 dígitos, `turno` 1–3, INE |
| **Procedimentos (7)** | `Downloads/sistemas 2/5974691` | 2675 | **`/procedimentos/lote`** | `stNaoPossuiCpf`, códigos SIGTAP (evitar `ABPGxxx`) |

### Regra de ouro

- **Saúde bucal / Previne B1–B6 / RNDS odonto** → só **FAO (5)** em `/odonto/lote`.
- Subir FAI ou Procedimentos na tela errada gera **`WRONG_FICHA_TIPO`**.
- FAI e Procedimentos compartilham o blocker universal `stNaoPossuiCpf`.

## Amostra mista

Ver `18-amostra-novas-fichas-exemplo.md` (12 FAO + 20 FAI + 7 Procedimentos).

---

## Relatório detalhado por lote

- FAO → `docs/conhecimento/analise-lote-fao-5974691.md`
- FAI → `docs/conhecimento/analise-lote-fai-5974691.md`
- Procedimentos → `docs/conhecimento/analise-lote-procedimentos-5974691.md`

---

## Próximo passo de produto

1. `/odonto/lote` = FAO · `/aps/lote` = FAI · `/procedimentos/lote` = tipo 7.  
2. Auto-correção `stNaoPossuiCpf` nos três canais.  
3. Evoluir FAI/PROC com gráficos/filtro no mesmo padrão do FAO.