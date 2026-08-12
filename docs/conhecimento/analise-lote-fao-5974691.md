# Análise lote XML — FAO (Atendimento Odontológico)

**Gerado:** 2026-08-12  
**Pasta:** `/Users/leandroborges/Downloads/5974691`  
**Arquivos:** 1131 (`atendimentoodontologico-*.esus.xml`)  
**Validador:** `apps/api` — `validateFaoXml` (LEDI FAO → Siaps → RNDS)

## Identificação

| Item | Valor |
|---|---|
| `tipoDadoSerializado` | **5** = Ficha de **Atendimento Odontológico** (FAO) |
| Envelope | `dadoTransporteTransportXml` + `fichaAtendimentoOdontologicoMasterTransport` |
| Município (IBGE) | `3516200` (Franca) |
| Origem | SIGS legado **3.3.186** (`tpCdsOrigem=3`) |
| CBO | **223208** (Cirurgião-dentista) em **100%** |

**Este é o lote certo para odonto/RNDS.** Os dumps anteriores (FAI tipo 4 e Procedimentos tipo 7) não servem para saúde bucal.

**LGPD:** XML com CNS reais — não versionar no repositório. Resumo agregado: `analise-lote-fao-5974691-summary.json`.

## Conformidade (validador Nest)

| Métrica | Valor |
|---|---:|
| Total | 1131 |
| Conformes | **0** |
| Com BLOCKER | **1131 (100%)** |
| Com MONEY_RISK | 0 |

### Críticas por código (arquivos afetados)

| Código | Qtd | % | Severidade | Significado |
|---|---:|---:|---|---|
| `PROBLEMAS_MISSING` | **1131** | 100% | BLOCKER | Sem `problemasCondicoes` (CIAP/CID10) |
| `ST_NAO_POSSUI_CPF` | **1131** | 100% | BLOCKER | Sem `stNaoPossuiCpf` (mesmo padrão FAI/Procedimentos) |
| `INE_MISSING` | 166 | 14,7% | QUALITY_WARN | Sem INE no envelope/lotação |
| `TIPO_CONSULTA_REQUIRED` | 3 | 0,3% | BLOCKER | `tipoAtendimento=2` sem `tiposConsultaOdonto` |
| `TRATAMENTO_CONCLUIDO_RULE` | 2 | 0,2% | BLOCKER | Conduta 15 exige consulta 1 ou 2 |

## Distribuições úteis

**tipoAtendimento:** 2=795 · 6=203 · 5=104 · 4=29  

**tiposConsultaOdonto:** 2=520 · 4=263 · 1=257 · ausente=91  

**tiposVigilanciaSaudeBucal:** **99** (outro)=973 · 3=150 · demais raros  

**Condutas (tiposEncamOdonto) mais frequentes:** 11=545 · 16=319 · 15=177 · 6=131 · 17=85  

**Top SIGTAP:** `0301010030` (645), `0101020104` (390), `0301010153` (285), `0301060037` (202), `0307010120` (181)…

## Correção no gerador (SIGS 3.3.186 / reescrita Nest)

1. Sempre emitir `<stNaoPossuiCpf>false</stNaoPossuiCpf>` quando há CPF/CNS.
2. Exigir ≥1 `problemasCondicoes` com CIAP e/ou CID10 antes de finalizar a ficha (já no finish odonto da API).
3. Preencher `ine` na lotação (166 fichas sem INE no envelope).
4. Se `tipoAtendimento=2`, obrigar `tiposConsultaOdonto`; se conduta 15, só com consulta 1 ou 2.
5. Revisar uso massivo de vigilância **99** (“outro”) — pode mascarar produção/vigilância.

## Parser

O validador LEDI FAO passou a **desembrulhar** o envelope `dadoTransporteTransportXml` quando há FAO XML embutida (antes classificava tudo como `FORMAT_DADO_TRANSPORT`). INE/CNES do envelope passam a preencher a lotação quando ausentes no header.

## Próximo passo

- Regenerar lote com `stNaoPossuiCpf` + `problemasCondicoes`.
- Validar amostra em `POST /v1/dental/ledi/validate-xml` ou na UI `/odonto`.
- Relatório visual/PDF: canvas `ledi-xml-analise-fao` + PDF em `docs/conhecimento/`.
