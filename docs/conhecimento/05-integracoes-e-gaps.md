# Integrações e lacunas — e-SUS 5.5.24

Relatórios: `09-integration-map.md`, `10-gaps.md`.

## Integrações com evidência no artefato

| Nome | Evidência | Confiança |
|---|---|---|
| LEDI (Thrift) | `pec-ledi-thrift-6.2.10.jar` | DIRECT_SOURCE |
| Sync protocol | `sync-common-protocol*-5.2.8.jar` | DIRECT_SOURCE |
| Sync AD | `sync-common-protocol-ad-thrift-5.2.8.jar` | DIRECT_SOURCE |
| Transport / RAS | `transport.*`, `ras.transport`, `pec.transport.business.impl` | DIRECT_SOURCE |
| CadSUS PIX | `ws-client-pix-1.11.jar` | DIRECT_SOURCE |
| CadSUS PDQ | `ws-client-pdq-1.10.jar` | DIRECT_SOURCE |
| MPI | `mpi-client-1.5.jar` | DIRECT_SOURCE |
| Unificação de bases | `unificacao-5.5.24.jar` | DIRECT_SOURCE |
| RNDS | migrations/packages com `rnds` | STRONG_INFERENCE (confirmar em código) |
| CNES | termos em classes | STRONG_INFERENCE |
| SIGTAP | poucos hits de nome | WEAK_INFERENCE até decompilação |
| SISAB / SIAPS | possível via LEDI | WEAK_INFERENCE |

## Não confirmado / parcial no inventário

| Feature | Status inventário | Próxima fonte |
|---|---|---|
| Geração APAC | PARTIAL_OR_NAME_HIT | SIA / especificação APAC / decompilação billing |
| Geração BPA | PARTIAL_OR_NAME_HIT | SIA / BPA |
| RAAS | NOT_FOUND no inventário de nomes | especificação RAAS |
| UPA / urgência completa | PARTIAL | TR Franca + módulos hospitalares (fora do núcleo APS) |
| Regulação avançada | PARTIAL | e-SUS Reg / TR módulo regulação |
| FHIR RNDS completo | PARTIAL | docs RNDS + decompilação |
| SIGTAP embarcado completo | WEAK | importação SIGTAP (TR § faturamento) |

## Limitações desta fase

- Ainda não há decompilação em massa dos JARs P0 (apenas smoke test).
- Frontend pode estar minificado em `esus.web` — telas ainda não mapeadas.
- Schema Liquibase indexado, mas modelo conceitual ainda não gerado em `analysis/entities.json`.

## Implicação para o TR Franca

Vários módulos do TR (**SAMU, Laboratorial LIS completo, Farmácia estoque, Hospitalar/UPA, Transporte/TFD, PPI, Apps cidadão**) **não são cobertos** (ou só de forma residual) pelo e-SUS APS.  
Para esses módulos, o e-SUS **não** é fonte suficiente — usar TR + normas + outras referências.
