# Desenho — lote XML CDS tipos 2 / 3 / 6 / 8 / 10

**Status:** wizard live (schema sintético) — 2026-08-16  
**Contexto:** dump Franca 5974691 **não** trouxe XMLs desses tipos; implementação usa `TipoDadoTranspEnum` + tags `*Transport` + fixtures sintéticas (sem PHI). Não inventar dump `TB_FAIXA`.

## Fonte (sem inventar)

| Fonte | O que confirma |
|---|---|
| `TipoDadoTranspEnum` (`cds.common.api-5.5.24.jar`) | códigos envelope |
| DTOs `*Transport` + thrift master | tags / structs |
| Origem nativa SIGS | `/pacientes`, `/territorio`, `/coletivo`, `/ad` |
| Padrão FAI/FAO/PROC | header · `stNaoPossuiCpf` · gate · 2 ZIPs |

| Código | Enum e-SUS | Tag XML | Origem nativa | Wizard |
|---:|---|---|---|---|
| **2** | `CDS_CADASTRO_INDIVIDUAL` | `cadastroIndividualTransport` | `/pacientes` | `/faturamento/lote/cadastro-individual` |
| **3** | `CDS_CADASTRO_DOMICILIAR` | `cadastroDomiciliarTransport` | `/territorio` | `/faturamento/lote/domicilio` |
| **6** | `CDS_ATIVIDADE_COLETIVA` | `fichaAtividadeColetivaMasterTransport` | `/coletivo` | `/faturamento/lote/coletivo` |
| **8** | `CDS_FICHA_VISITA_DOMICILIAR` | `fichaVisitaDomiciliarMasterTransport` | `/territorio` | `/faturamento/lote/visita-acs` |
| **10** | `CDS_FICHA_ATENDIMENTO_DOMICILIAR` | `fichaAtendimentoDomiciliarMasterTransport` | `/ad` | `/faturamento/lote/ad` |

**Nota:** vacinação no enum é **14** (`CDS_FICHA_VACINACAO`); código **2** = cadastro individual. Lote 14 = stub nesta onda.

## Entrega atual (DoD)

1. Gate de tipo — ZIP errado em qualquer tela live → `LEDI_TIPO_MISMATCH` (lote **não** analisa).
2. `GET /v1/faturamento/ledi-cds-lotes` — catálogo live 2/3/4/5/6/7/8/10 + stub 14.
3. Shell `LediTipoLotePage` + jobs async + export 2 ZIPs.
4. RulePack CDS + autofix seguro + cruzamento municipal quando cadastro mestre sync.
5. Fixtures sintéticas + testes + manuais.

## Limitações

- Sem golden XML municipal → críticos estruturais além de header/identidade são mínimos.
- Quando houver ZIP amostra, calibrar BLOCKER específicos sem regressão 4/5/7.

## Rastreio

- RF-2.29 · RF-2.30 · RF-17.11 · RF-3.54 · RF-10.3
- Irmão: [fluxo-lote-ledi-wizard.md](fluxo-lote-ledi-wizard.md) · [mvp-correcao-dados-aps.md](mvp-correcao-dados-aps.md)
