# Análise lote XML — Ficha de Procedimentos

**Gerado:** 2026-08-12  
**Pasta:** `/Users/leandroborges/Downloads/sistemas 2/5974691`  
**Arquivos:** 2675 (`cadastroprocedimentos-*.esus.xml`)

## Identificação

| Item | Valor |
|---|---|
| `tipoDadoSerializado` | **7** = Ficha de **Procedimentos** |
| Envelope | `dadoTransporteTransportXml` + `fichaProcedimentoMasterTransport` |
| Município (IBGE) | `3516200` (Franca) |
| Origem | SIGS legado **3.3.185** (`tpCdsOrigem=3`) |
| INE | presente em **100%** das fichas (ex.: `0001613030`) |
| CNES (amostra) | 7 dígitos (ex.: `2049074`) — ok |

**Não é odonto.** Odonto LEDI é tipo **5** (FAO). Este lote é ficha de procedimentos (tipo 7).

**LGPD:** os XML contêm CNS/CPF reais — não versionar no repositório.

## Por que tende a falhar no Siaps / caminho RNDS

Validação estrutural sobre os 2675 arquivos:

| Crítica | Qtd | Severidade | O que significa |
|---|---:|---|---|
| `ST_NAO_POSSUI_CPF_MISSING` | **2675 (100%)** | BLOCKER | Campo obrigatório `stNaoPossuiCpf` ausente em todos os children |
| `PROC_CODE_ABPG` | **210** | BLOCKER / MONEY_RISK | Código `ABPGxxx` em `<procedimentos>` (ex.: `ABPG028`) — LEDI espera SIGTAP 10 dígitos nesse campo |
| `CNS_INVALID` | 1 | BLOCKER | CNS do cidadão falha no algoritmo módulo 11 |

INE, CNES 7 dígitos, turno, local, data/hora e identificação do cidadão (quando CNS válido) estão em geral ok. O bloqueio universal é o mesmo do lote FAI: **`stNaoPossuiCpf`**.

## Procedimentos mais frequentes (SIGTAP)

| Código | Qtd (aprox.) | Observação |
|---|---:|---|
| `0301100039` | 1343 | Consulta na atenção básica |
| `0101040024` | 843 | Aferição de PA (e afins) |
| `0214010015` | 221 | Exame citopatológico / correlato |
| `0201020033` | 23 | |
| `0301100012` | 19 | |
| `0401010015` | 13 | |

Códigos **ABPG** encontrados (210 fichas): `ABPG028` (51), `ABPG029` (41), `ABPG035` (40), `ABPG007` (31), `ABPG018`/`ABPG041` (20), demais raros. No gerador legado, mapear ABPG → SIGTAP oficial antes de serializar.

## CBO mais frequentes

`322205` (1253), `225125` (524), `225142` (210), `322230` (188), `322245` (129), `225124` (128), `225250` (114), `223505` (101) — perfil misto APS (enfermagem/médico), não exclusivo de odonto.

## Correção sugerida no gerador (SIGS legado / reescrita)

1. Sempre emitir `<stNaoPossuiCpf>false</stNaoPossuiCpf>` quando há CPF ou CNS; se não houver CPF, `true` + `justificativaNaoPossuiCpf`.
2. Em `<procedimentos>`, só SIGTAP com **10 dígitos**; converter/categorizar ABPG fora desse campo (ou no catálogo LEDI correto).
3. Validar CNS antes do export.
4. Manter INE e CNES 7 dígitos (já ok neste lote).

## Próximo passo

- Se o objetivo é **odonto/RNDS**: exportar fichas tipo **5** (FAO), não este lote nem o FAI (tipo 4).
- Se o objetivo é **corrigir este lote de procedimentos**: regenerar com `stNaoPossuiCpf` + SIGTAP 10 dígitos (sem ABPG cru).
- Opcional na reescrita Nest: validador LEDI tipo 7 espelhando o de FAO (`POST /v1/.../ledi/validate-xml`).
