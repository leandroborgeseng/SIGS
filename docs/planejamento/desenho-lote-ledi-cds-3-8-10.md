# Desenho — lote XML CDS tipos 3 / 8 / 10

**Status:** desenho + stubs (sem wizard de validação/ZIP)  
**Data:** 2026-08-16  
**Decisão:** **não** implementar pipeline FAI/FAO/PROC completo — dump Franca 5974691 **não** trouxe XMLs desses tipos; autofix/registry sem amostra seria inventar norma.

## Fonte (sem inventar)

| Fonte | O que confirma |
|---|---|
| `TipoDadoTranspEnum` (`cds.common.api-5.5.24.jar`) | códigos envelope |
| DTOs `*Transport` + thrift master | tags / structs |
| Origem nativa SIGS | `/territorio`, visitas ACS, `/ad` |

| Código | Enum e-SUS | Tag XML (JAXB / padrão `*Transport`) | Origem nativa SIGS | Stub UI |
|---:|---|---|---|---|
| **3** | `CDS_CADASTRO_DOMICILIAR` | `cadastroDomiciliarTransport` | `/territorio` (Household/Family) | `/faturamento/lote/domicilio` |
| **8** | `CDS_FICHA_VISITA_DOMICILIAR` | `fichaVisitaDomiciliarMasterTransport` | `/territorio` aba Visitas ACS | `/faturamento/lote/visita-acs` |
| **10** | `CDS_FICHA_ATENDIMENTO_DOMICILIAR` | `fichaAtendimentoDomiciliarMasterTransport` | `/ad` (`ledi-homecare-v2`) | `/faturamento/lote/ad` |

**Nota:** vacinação no enum é **14** (`CDS_FICHA_VACINACAO` / `fichaVacinacaoMasterTransport`); código **2** é cadastro individual. Detector SIGS alinhado a isso nesta onda.

## O que o stub entrega agora

1. Detecção de tipo (código + tag) no gate — ZIP 3/8/10 em tela 4/5/7 → `LEDI_TIPO_MISMATCH` (lote **não** analisa).
2. `GET /v1/faturamento/ledi-cds-lotes` — catálogo live vs stub + blockers.
3. Telas stub no hub (sem upload) + links para origem nativa.
4. Este desenho + STATUS / cobertura-rf.

## O que falta para wizard real (DoD futuro)

1. **Amostra ZIP** municipal (ou golden XML) tipos 3, 8 e 10 — espelhar análise Franca 4/5/7.
2. Validador mínimo (header CNS/CBO/CNES/INE, UUID, filhos) **sem** inventar BLOCKER.
3. Reusar shell `LediTipoLotePage` + `assertLoteTipoMatch` com `LediLoteTipo` estendido.
4. Autofix só campos seguros (mesmo critério FAI).
5. Export 2 ZIPs + testes golden.
6. Manual usuário final + ajuda na tela.

## Fora de escopo

- Wizard upload/autofix/ZIP destes tipos nesta fase.
- Dump `TB_FAIXA_ETARIA_VACINACAO`.
- Claude Design UI completa · SAMU/LIS/TFD.

## API stub

```http
GET /v1/faturamento/ledi-cds-lotes
```

Resposta: lista `{ code, id, label, loteXmlStatus: 'live'|'stub', href?, nativeHref?, blocker }`.

Live hoje: 4 FAI · 5 FAO · 7 PROC. Stub: 3 · 8 · 10.

## Rastreio

- RF-2.29 · RF-17.11 · RF-3.54 · RF-10.3 (extensão futura)
- Irmão: [fluxo-lote-ledi-wizard.md](fluxo-lote-ledi-wizard.md)
