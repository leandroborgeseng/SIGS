# Mapa de integrações preliminar — e-SUS APS 5.5.24

## Integrações com evidência no artefato

| Nome | Evidência | Direção (hipótese) | Confiança |
|---|---|---|---|
| LEDI (Thrift) | `pec-ledi-thrift-6.2.10.jar`, classes thrift | exportação/transmissão fichas | DIRECT_SOURCE (artefato) |
| Sync protocol | `sync-common-protocol*-5.2.8.jar` | sincronização entre nós | DIRECT_SOURCE |
| Sync AD thrift | `sync-common-protocol-ad-thrift-5.2.8.jar` | atenção domiciliar / sync | DIRECT_SOURCE |
| Transport | `transport.*.jar`, `pec.transport.business.impl` | transporte de dados | DIRECT_SOURCE |
| CadSUS PIX | `ws-client-pix-1.11.jar` | consulta/identificação cidadão | DIRECT_SOURCE |
| CadSUS PDQ | `ws-client-pdq-1.10.jar` | busca demográfica | DIRECT_SOURCE |
| Unificação | `unificacao-5.5.24.jar` | unificação de bases/cadastros | DIRECT_SOURCE |
| RNDS | packages/migrations `rnds` (a confirmar em classes) | envio/consulta RNDS | STRONG_INFERENCE |
| CNES | termos em classes/resources | cadastro de estabelecimentos/equipes | STRONG_INFERENCE |
| SIGTAP | termos em classes (a confirmar) | procedimentos | WEAK_INFERENCE até decompilação |
| SISAB/SIAPS | a confirmar | produção APS | WEAK_INFERENCE / possível via LEDI |

## JARs de integração

- `mpi-client-1.5.jar` — ESUS_INTEGRATION / P0
- `pec-ledi-thrift-6.2.10.jar` — ESUS_LEDI / P0
- `pec.transport.business.impl-5.5.24.jar` — ESUS_INTEGRATION / P0
- `ras.transport-5.5.24.jar` — ESUS_INTEGRATION / P0
- `sync-common-api-5.2.8.jar` — ESUS_INTEGRATION / P0
- `sync-common-api-bean-5.2.8.jar` — ESUS_INTEGRATION / P0
- `sync-common-api-thrift-5.2.8.jar` — ESUS_LEDI / P0
- `sync-common-protocol-5.2.8.jar` — ESUS_INTEGRATION / P0
- `sync-common-protocol-ad-thrift-5.2.8.jar` — ESUS_LEDI / P0
- `sync-common-protocol-thrift-5.2.8.jar` — ESUS_LEDI / P0
- `transport.common.api-5.5.24.jar` — ESUS_INTEGRATION / P0
- `transport.lib-5.5.24.jar` — ESUS_INTEGRATION / P0
- `transport.persistence.impl.jpa-5.5.24.jar` — ESUS_INTEGRATION / P0
- `transport.service.api-5.5.24.jar` — ESUS_INTEGRATION / P0
- `transport.service.impl-5.5.24.jar` — ESUS_INTEGRATION / P0
- `unificacao-5.5.24.jar` — ESUS_DOMAIN / P0
- `ws-client-pdq-1.10.jar` — ESUS_INTEGRATION / P0
- `ws-client-pix-1.11.jar` — ESUS_INTEGRATION / P0

## Classes de integração (amostra)

- `br.gov.esus.ad.business.impl.AtencaoDomiciliarSyncEntityServiceImpl`
- `br.gov.esus.ad.common.enums.TipoAtencaoDomiciliarSync`
- `br.gov.esus.ad.common.thrift.PerfilListingRowThrift`
- `br.gov.esus.ad.common.thrift.PerfilListingRowThrift$1`
- `br.gov.esus.ad.common.thrift.PerfilListingRowThrift$PerfilListingRowThriftStandardScheme`
- `br.gov.esus.ad.common.thrift.PerfilListingRowThrift$PerfilListingRowThriftStandardSchemeFactory`
- `br.gov.esus.ad.common.thrift.PerfilListingRowThrift$PerfilListingRowThriftTupleScheme`
- `br.gov.esus.ad.common.thrift.PerfilListingRowThrift$PerfilListingRowThriftTupleSchemeFactory`
- `br.gov.esus.ad.common.thrift.PerfilListingRowThrift$_Fields`
- `br.gov.esus.ad.common.thrift.UsuarioDtoThrift`
- `br.gov.esus.ad.common.thrift.UsuarioDtoThrift$1`
- `br.gov.esus.ad.common.thrift.UsuarioDtoThrift$UsuarioDtoThriftStandardScheme`
- `br.gov.esus.ad.common.thrift.UsuarioDtoThrift$UsuarioDtoThriftStandardSchemeFactory`
- `br.gov.esus.ad.common.thrift.UsuarioDtoThrift$UsuarioDtoThriftTupleScheme`
- `br.gov.esus.ad.common.thrift.UsuarioDtoThrift$UsuarioDtoThriftTupleSchemeFactory`
- `br.gov.esus.ad.common.thrift.UsuarioDtoThrift$_Fields`
- `br.gov.saude.componente.pixpdq.enuns.TipoCertidaoEnum`
- `br.gov.saude.componente.pixpdq.enuns.TipoComunicacaoEnum`
- `br.gov.saude.componente.pixpdq.enuns.TipoConfidencialidadeEnum`
- `br.gov.saude.componente.pixpdq.enuns.TipoConsultaEnum`
- `br.gov.saude.componente.pixpdq.enuns.TipoCorRacaEnum`
- `br.gov.saude.componente.pixpdq.enuns.TipoEnderecoEnum`
- `br.gov.saude.componente.pixpdq.enuns.TipoEtniaEnum`
- `br.gov.saude.componente.pixpdq.enuns.TipoLogradouroEnum`
- `br.gov.saude.componente.pixpdq.enuns.TipoModeloCertidaoEnum`
- `br.gov.saude.componente.pixpdq.enuns.TipoNacionalidadeEnum`
- `br.gov.saude.componente.pixpdq.enuns.TipoOrgaoEmissorEnum`
- `br.gov.saude.componente.pixpdq.enuns.TipoPaisEnum`
- `br.gov.saude.componente.pixpdq.enuns.TipoSanguineoEnum`
- `br.gov.saude.componente.pixpdq.enuns.TipoSexoEnum`
- `br.gov.saude.componente.pixpdq.enuns.TipoTelefoneEnum`
- `br.gov.saude.componente.pixpdq.enuns.TipoUfEnum`
- `br.gov.saude.componente.pixpdq.model.CNS`
- `br.gov.saude.componente.pixpdq.model.Certidao`
- `br.gov.saude.componente.pixpdq.model.Cnh`
- `br.gov.saude.componente.pixpdq.model.Comunicacao`
- `br.gov.saude.componente.pixpdq.model.Ctps`
- `br.gov.saude.componente.pixpdq.model.DadosWsPixPdq`
- `br.gov.saude.componente.pixpdq.model.Endereco`
- `br.gov.saude.componente.pixpdq.model.IdentificadorSistema`
- `br.gov.saude.componente.pixpdq.model.LocalNascimento`
- `br.gov.saude.componente.pixpdq.model.Naturalizado`
- `br.gov.saude.componente.pixpdq.model.Passaporte`
- `br.gov.saude.componente.pixpdq.model.RG`
- `br.gov.saude.componente.pixpdq.model.TituloEleitor`
- `br.gov.saude.esus.CidadaoVinculacaoEquipeTransportService`
- `br.gov.saude.esus.business.impl.exportarpec.transmissible.common.LotacaoHeaderTransportServiceImpl`
- `br.gov.saude.esus.business.impl.exportarpec.transmissible.common.RndsTransportService`
- `br.gov.saude.esus.cds.common.api.constants.CuidadoCompartilhadoTransportValidatorConstants`
- `br.gov.saude.esus.cds.common.api.presentervalidation.CdsTransportDbValidatorHashHelper`

## Resources relacionados (amostra)

- `api-5.7.31.jar:thrift/configuracao_destino.thrift`
- `api-5.7.31.jar:thrift/configuracao_destino_api.thrift`
- `api-5.7.31.jar:thrift/dado_transporte.thrift`
- `api-5.7.31.jar:thrift/mainservicethrift.thrift`
- `backend-5.5.24.jar:cnes/cnes_2.1.xsd`
- `backend-5.5.24.jar:cnes/cnes_3.0.xsd`
- `backend-5.5.24.jar:cnes/cnes_3.1.xsd`
- `backend-5.5.24.jar:rnds/AllergyIntoleranceRAC.json`
- `backend-5.5.24.jar:rnds/AtestadoRAC.json`
- `backend-5.5.24.jar:rnds/BundleRAC.json`
- `backend-5.5.24.jar:rnds/CarePlanRAC.json`
- `backend-5.5.24.jar:rnds/CompositionPrescricaoMedicamentoREPM.json`
- `backend-5.5.24.jar:rnds/CompositionPrescricaoMedicamentoRPM.json`
- `backend-5.5.24.jar:rnds/CompositionRAC.json`
- `backend-5.5.24.jar:rnds/ConditionRAC.json`
- `backend-5.5.24.jar:rnds/DiagnosisProcedureRAC.json`
- `backend-5.5.24.jar:rnds/DiagnosisRAC.json`
- `backend-5.5.24.jar:rnds/DosageInstructionREPM.json`
- `backend-5.5.24.jar:rnds/DosageInstructionRPM.json`
- `backend-5.5.24.jar:rnds/EncounterRAC.json`
- `backend-5.5.24.jar:rnds/MarcoDesenvolvimentoInfantilRAC.json`
- `backend-5.5.24.jar:rnds/MedicationREPM.json`
- `backend-5.5.24.jar:rnds/MedicationRPM.json`
- `backend-5.5.24.jar:rnds/MedicationRequestREPM.json`
- `backend-5.5.24.jar:rnds/MedicationRequestRPM.json`
- `backend-5.5.24.jar:rnds/ObservationMeasure.json`
- `backend-5.5.24.jar:rnds/ProcedureRAC.json`
- `backend-5.5.24.jar:rnds/ReferenciaPrescricaoMedicamento.json`
- `backend-5.5.24.jar:rnds/RegistroVacinacaoRNDS.json`
- `backend-5.5.24.jar:rnds/ResourceEntryRAC.json`
- `backend-5.5.24.jar:rnds/ResourceReferenceRAC.json`
- `database-5.5.24.jar:db/piloto/sigtap-202606/sigtap-202606.yaml`
- `database-5.5.24.jar:db/piloto/sigtap-202606/sql/02_cid10/TB_CID10-UPDATE.sql`
- `database-5.5.24.jar:db/piloto/sigtap-202606/sql/04_subgrupo/TB_PROCED_SUBGRUPO-INSERT.sql`
- `database-5.5.24.jar:db/piloto/sigtap-202606/sql/05_forma_organizacional/TB_PROCED_FORMA_ORGANIZACIONAL-INSERT.sql`
- `database-5.5.24.jar:db/piloto/sigtap-202606/sql/08_procedimento/TB_PROCED-INSERT.sql`
- `database-5.5.24.jar:db/piloto/sigtap-202606/sql/08_procedimento/TB_PROCED-UPDATE_ST_ATIVO.sql`
- `database-5.5.24.jar:db/piloto/sigtap-202606/sql/09_rl_proced_ocupacao/RL_PROCED_CBO-DELETE.sql`
- `database-5.5.24.jar:db/piloto/sigtap-202606/sql/09_rl_proced_ocupacao/RL_PROCED_CBO-INSERT.sql`
- `database-5.5.24.jar:db/piloto/sigtap-202606/sql/10_rl_proced_cid10/RL_PROCED_CID10-INSERT.sql`
