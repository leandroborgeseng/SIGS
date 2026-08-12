# Análise lote XML — Atendimento Individual (FAI)

**Gerado:** 2026-08-12  
**Pasta:** `/Users/leandroborges/Downloads/sistemas/5974691`  
**Arquivos:** 8149 (`cadastroatendimentoindividual-*.esus.xml`)

## Identificação

| Item | Valor |
|---|---|
| `tipoDadoSerializado` | **4** = Ficha de **Atendimento Individual** |
| Envelope | `dadoTransporteTransportXml` + `fichaAtendimentoIndividualMasterTransport` |
| Município (IBGE) | `3516200` (Franca) |
| Origem | SIGS legado **3.3.185** (`tpCdsOrigem=3`) |

**Não é odonto.** Odonto LEDI é tipo **5** (FAO). Este lote não serve para validar saúde bucal.

**LGPD:** os XML contêm CNS/CPF reais — não versionar no repositório.

## Por que tende a falhar no Siaps / caminho RNDS

Validação estrutural LEDI FAI (dicionário Bridge) sobre os 8149 arquivos:

| Crítica | Qtd | Severidade | O que significa |
|---|---:|---|---|
| `ST_NAO_POSSUI_CPF_MISSING` | **8149 (100%)** | BLOCKER | Campo obrigatório `stNaoPossuiCpf` ausente em todos os XMLs |
| `INE_MISSING` | 2506 (~31%) | WARN | Lotação sem INE da equipe |
| `CNES_FORMAT` | 182 | BLOCKER | CNES com **8 dígitos** (`20876691`) — LEDI exige **7** |
| `TURNO_INVALID` | 62 | BLOCKER | `turno=0` (válido: 1, 2 ou 3) |
| `CNS_INVALID` | 2 | BLOCKER | CNS do cidadão falha no algoritmo módulo 11 |

Quase nenhum arquivo está “limpo”: o bloqueio universal é o **`stNaoPossuiCpf`**.

## Distribuição útil

- **tipoAtendimento:** 1=4241 · 2=3426 · 5=424 · 4=56 · 6=2 (todos valores permitidos na FAI: 1,2,4,5,6)
- **CBO mais frequentes:** 225125, 251510, 225142, 225250, 225124, 225265…

## Correção sugerida no gerador (SIGS legado / reescrita)

1. Sempre emitir `<stNaoPossuiCpf>false</stNaoPossuiCpf>` quando há CPF ou CNS; se não houver CPF, `true` + `justificativaNaoPossuiCpf`.
2. Corrigir cadastro CNES `20876691` → CNES oficial de 7 dígitos.
3. Nunca exportar `turno=0`; mapear para 1/2/3.
4. Preencher `ine` na lotação quando a equipe tiver INE.
5. Validar CNS antes do export.

## Próximo passo

- Se o objetivo é **odonto/RNDS**: exportar fichas tipo **5** (FAO), não este lote.
- Se o objetivo é **corrigir este lote AI**: regenerar com `stNaoPossuiCpf` + CNES 7 dígitos + turno válido.
