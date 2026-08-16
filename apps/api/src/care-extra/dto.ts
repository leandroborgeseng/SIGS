import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LEDI_ZIP_MAX_BYTES, LEDI_ZIP_MAX_CHUNKS } from './ledi-zip.limits';

export class DentalProcedureDto {
  @IsOptional() @IsString() tooth?: string;
  @IsOptional() @IsString() region?: string;
  @IsString() code!: string;
  @IsString() label!: string;
  @IsOptional() @IsBoolean() done?: boolean;
}

export class CreateDentalEncounterDto {
  @IsString() patientId!: string;
  @IsString() facilityId!: string;
  @IsOptional() @IsString() professionalId?: string;
  @IsOptional() @IsString() assignmentId?: string;
  @IsOptional() @IsString() cbo?: string;
  @IsOptional() @IsString() encounterType?: string;
  @IsOptional() @IsString() anamnese?: string;
  /** Abre a partir de AppointmentSlot (RF-12.1) — marca slot PRESENT e tipoAtendimento=2 */
  @IsOptional() @IsString() appointmentId?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DentalProcedureDto)
  procedures?: DentalProcedureDto[];
  @IsOptional() @IsObject() odontogram?: Record<string, string>;
}

export class DentalProblemaDto {
  @IsOptional() @IsString() ciap?: string;
  @IsOptional() @IsString() cid10?: string;
}

export class DentalTreatmentCycleDto {
  @IsString() id!: string;
  @IsOptional() @IsString() number?: string | null;
  @IsString() startedAt!: string;
  @IsOptional() @IsString() endedAt?: string | null;
  @IsIn(['OPEN', 'FINALIZED', 'INTERRUPTED']) status!: 'OPEN' | 'FINALIZED' | 'INTERRUPTED';
}

export class DentalReferralDto {
  @IsString() id!: string;
  @IsString() specialty!: string;
  @IsString() justification!: string;
  @IsString() createdAt!: string;
}

export class PatchDentalEncounterDto {
  @IsOptional() @IsString() anamnese?: string;
  @IsOptional() @IsString() assignmentId?: string;
  @IsOptional() @IsString() cbo?: string;
  @IsOptional() @IsString() professionalId?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DentalProcedureDto)
  procedures?: DentalProcedureDto[];
  @IsOptional() @IsObject() odontogram?: Record<string, string>;
  /** Campos LEDI do rascunho (merge parcial) */
  @IsOptional() @IsInt() tipoAtendimento?: number;
  @IsOptional() @IsArray() tiposConsultaOdonto?: number[];
  @IsOptional() @IsInt() localAtendimento?: number;
  @IsOptional() @IsInt() turno?: number;
  @IsOptional() @IsBoolean() gestante?: boolean;
  @IsOptional() @IsBoolean() necessidadesEspeciais?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) outcomes?: string[];
  @IsOptional() @IsArray() vigilanciaSaudeBucal?: number[];
  @IsOptional() @IsArray() @IsString({ each: true }) fornecimentos?: string[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DentalProblemaDto)
  problemasCondicoes?: DentalProblemaDto[];
  @IsOptional() @IsBoolean() stNaoPossuiCpf?: boolean;
  @IsOptional() @IsInt() justificativaNaoPossuiCpf?: number;
  @IsOptional() @IsString() dataHoraInicialAtendimento?: string;
  @IsOptional() @IsString() dataHoraFinalAtendimento?: string;
  /** Antecedentes / observações / textos do odontograma (careJson) */
  @IsOptional() @IsString() antecedentes?: string;
  @IsOptional() @IsString() observacoes?: string;
  @IsOptional() @IsString() planejamentoTratamento?: string;
  @IsOptional() @IsString() tratamentoRealizadoNotas?: string;
  @IsOptional() @IsObject() toothNotes?: Record<string, string>;
  @IsOptional() @IsObject() odontogramFaces?: Record<string, Record<string, string>>;
  /** null limpa o ciclo; objeto inicia/atualiza (≠ finish da consulta) */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @ValidateNested()
  @Type(() => DentalTreatmentCycleDto)
  treatment?: DentalTreatmentCycleDto | null;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DentalReferralDto)
  referrals?: DentalReferralDto[];
}

/**
 * Anula odonto: rascunho (`IN_PROGRESS`) ou pós-fechamento (`COMPLETED`).
 * Pós-COMPLETED é anulação local (fila/lote); não faz recall no Ministério/Siaps.
 */
export class VoidDentalEncounterDto {
  @IsOptional() @IsString() reason?: string;
  /**
   * Obrigatório quando status = COMPLETED: confirma ciência de que a anulação
   * é só no SIGS (sem estorno/XML de exclusão no Ministério).
   */
  @IsOptional() @IsBoolean() acknowledgeLocalOnly?: boolean;
}

/** Revalida pendências LEDI da fila de faturamento odonto (sync em lote). */
export class SyncDentalFaturamentoQueueDto {
  @IsOptional() @IsString() competencia?: string;
  @IsOptional() @IsString() facilityId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) encounterIds?: string[];
}

export class FinishDentalEncounterDto {
  /** Se omitido, usa careJson.outcomes */
  @IsOptional() @IsArray() @IsString({ each: true }) outcomes?: string[];
  @IsOptional() @IsDateString() finishedAt?: string;
  @IsOptional() @IsString() assignmentId?: string;
  @IsOptional() @IsString() cbo?: string;
  /** 2|4|5|6 — LEDI tipoAtendimento */
  @IsOptional() @IsInt() tipoAtendimento?: number;
  @IsOptional() @IsArray() tiposConsultaOdonto?: number[];
  @IsOptional() @IsInt() localAtendimento?: number;
  @IsOptional() @IsInt() turno?: number;
  @IsOptional() @IsString() shift?: string;
  @IsOptional() @IsString() careLocation?: string;
  @IsOptional() @IsBoolean() gestante?: boolean;
  @IsOptional() @IsBoolean() necessidadesEspeciais?: boolean;
  @IsOptional() @IsArray() vigilanciaSaudeBucal?: number[];
  @IsOptional() @IsArray() @IsString({ each: true }) fornecimentos?: string[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DentalProblemaDto)
  problemasCondicoes?: DentalProblemaDto[];
  @IsOptional() @IsBoolean() stNaoPossuiCpf?: boolean;
  @IsOptional() @IsInt() justificativaNaoPossuiCpf?: number;
  /** Default true — bloqueia finish com BLOCKER FAO */
  @IsOptional() @IsBoolean() enforceFaoConformity?: boolean;
}

export class ValidateDentalFaoDto {
  @IsOptional() @IsString() xml?: string;
  @IsOptional() @IsObject() master?: Record<string, unknown>;
}

export class LediFaoBatchFileDto {
  @IsString() name!: string;
  @IsString() xml!: string;
}

export class CreateLediFaoBatchDto {
  @IsOptional() @IsString() name?: string;
  /**
   * Canal do lote: FAO (odonto) | FAI (individual) | PROCEDIMENTOS.
   * Default FAO para compatibilidade com /faturamento/lote/fao.
   */
  @IsOptional() @IsString() expectedTipo?: 'FAO' | 'FAI' | 'PROCEDIMENTOS';
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LediFaoBatchFileDto)
  files!: LediFaoBatchFileDto[];
}

export class AppendLediFaoBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LediFaoBatchFileDto)
  files!: LediFaoBatchFileDto[];
}

/** ZIP em base64 — fallback legado; preferir POST multipart /upload-zip. */
export class CreateLediFaoBatchFromZipDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() expectedTipo?: 'FAO' | 'FAI' | 'PROCEDIMENTOS';
  @IsString() zipBase64!: string;
}

/**
 * Query do POST (preferido) / PUT /upload-zip/chunk.
 * Octet-stream: metadados na query, corpo = bytes.
 * Fallback Safari: POST JSON `{ uploadId, index, total, data: base64 }` —
 * query opcional (o controller lê o JSON se faltar).
 */
export class LediZipChunkQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
    message: 'uploadId inválido',
  })
  uploadId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  index?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LEDI_ZIP_MAX_CHUNKS)
  total?: number;

  @IsOptional() @IsString() fileName?: string;
  @IsOptional() @IsIn(['FAO', 'FAI', 'PROCEDIMENTOS']) expectedTipo?: 'FAO' | 'FAI' | 'PROCEDIMENTOS';
  @IsOptional() @IsString() name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LEDI_ZIP_MAX_BYTES)
  totalBytes?: number;
}

export class LediFaoProcDto {
  @IsString() coMsProcedimento!: string;
  @IsOptional() @IsInt() @Min(1) quantidade?: number;
}

export class AutoFixLediFaoBatchDto {
  /** Confirma correção de stNaoPossuiCpf (default true). */
  @IsOptional() @IsBoolean() stNaoPossuiCpf?: boolean;
  /** Se não há CPF/CNS no XML, valor a gravar (default true = não possui). */
  @IsOptional() @IsBoolean() stNaoPossuiCpfWhenAbsent?: boolean;
  /** INE a preencher quando INE_MISSING (opcional). */
  @IsOptional() @IsString() ine?: string;
  /**
   * Se informado, aplica o mesmo problemasCondicoes em todas as fichas
   * com PROBLEMAS_MISSING (confirmação explícita na UI).
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DentalProblemaDto)
  problemasCondicoesDefault?: DentalProblemaDto[];
  /** Restringe a correção às fichas selecionadas. */
  @IsOptional() @IsArray() @IsString({ each: true }) onlyItemIds?: string[];
  /**
   * Restringe às fichas que têm este código de alerta (findings / Previne / autoFixable).
   * Preferível a onlyItemIds quando o lote tem milhares de afetadas — evita o bug
   * da UI que só conhece a 1ª página (limit 300).
   */
  @IsOptional() @IsString() onlyCode?: string;
  /**
   * Se true (com onlyItemIds ou onlyCode), aplica os campos de patch abaixo
   * mesmo sem o código correspondente no findings.
   */
  @IsOptional() @IsBoolean() forceSelected?: boolean;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DentalProblemaDto)
  problemasCondicoes?: DentalProblemaDto[];
  @IsOptional() @IsArray() tiposConsultaOdonto?: number[];
  @IsOptional() @IsArray() tiposEncamOdontoAdd?: number[];
  @IsOptional() @IsArray() tiposVigilanciaSaudeBucal?: number[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LediFaoProcDto)
  procedimentosAdd?: LediFaoProcDto[];
  @IsOptional() @IsString() cboCodigo_2002?: string;
  @IsOptional() @IsInt() turno?: number;
  @IsOptional() @IsBoolean() gestante?: boolean;
  @IsOptional() @IsInt() localAtendimento?: number;
  @IsOptional() @IsString() cnes?: string;
  @IsOptional() @IsString() codigoIbgeMunicipio?: string;
  /** Motivo de não possuir CPF (1–13, 99) — exigido com stNaoPossuiCpf=true. */
  @IsOptional() @IsInt() justificativaNaoPossuiCpf?: number;
  /** JUSTIFICATIVA_CPF_UNEXPECTED: remover justificativa ou forçar st=true. */
  @IsOptional() @IsIn(['remove', 'force_st']) justificativaCpfUnexpected?: 'remove' | 'force_st';
  /** Regenerar uuidFicha inválido (default true no applyAutoFixes). */
  @IsOptional() @IsBoolean() regenerateUuidFicha?: boolean;
  /** Condutas FAI (TipoEncaminhamentoIndividual) — só com confirmação explícita. */
  @IsOptional() @IsArray() condutas?: number[];
  @IsOptional() @IsInt() tipoAtendimento?: number;
}

export class PatchLediFaoBatchItemDto {
  @IsOptional() @IsString() ine?: string;
  @IsOptional() @IsBoolean() stNaoPossuiCpf?: boolean;
  /** Motivo de não possuir CPF (1–13, 99). */
  @IsOptional() @IsInt() justificativaNaoPossuiCpf?: number;
  /** JUSTIFICATIVA_CPF_UNEXPECTED. */
  @IsOptional() @IsIn(['remove', 'force_st']) justificativaCpfUnexpected?: 'remove' | 'force_st';
  /** Regenerar uuidFicha com tamanho inválido. */
  @IsOptional() @IsBoolean() regenerateUuidFicha?: boolean;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DentalProblemaDto)
  problemasCondicoes?: DentalProblemaDto[];
  @IsOptional() @IsArray() tiposConsultaOdonto?: number[];
  /** Acrescenta condutas (ex.: 15 = tratamento concluído) sem remover as existentes. */
  @IsOptional() @IsArray() tiposEncamOdontoAdd?: number[];
  /** Substitui vigilância saúde bucal (ex.: sair do 99 genérico). */
  @IsOptional() @IsArray() tiposVigilanciaSaudeBucal?: number[];
  /** Acrescenta procedimentos SIGTAP se ainda não existirem. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LediFaoProcDto)
  procedimentosAdd?: LediFaoProcDto[];
  /** CBO lotação (família 2232* / 3224*). */
  @IsOptional() @IsString() cboCodigo_2002?: string;
  @IsOptional() @IsInt() turno?: number;
  @IsOptional() @IsBoolean() gestante?: boolean;
  @IsOptional() @IsInt() localAtendimento?: number;
  @IsOptional() @IsString() cnes?: string;
  @IsOptional() @IsString() codigoIbgeMunicipio?: string;
  /** CPF do cidadão (11 dígitos). */
  @IsOptional() @IsString() cpfCidadao?: string;
  /** CNS do cidadão (15–16 dígitos). */
  @IsOptional() @IsString() cnsCidadao?: string;
  /** Mantém só um ID quando CPF e CNS estão juntos. */
  @IsOptional() @IsIn(['cpf', 'cns']) keepCitizenId?: 'cpf' | 'cns';
  /** Nascimento YYYY-MM-DD ou epoch ms. */
  @IsOptional() @IsString() dtNascimento?: string;
  /** 0=masculino, 1=feminino */
  @IsOptional() @IsString() sexo?: string;
  /** CNS do profissional na lotação. */
  @IsOptional() @IsString() profissionalCNS?: string;
  /** dataAtendimento no header (YYYY-MM-DD ou epoch). */
  @IsOptional() @IsString() dataAtendimento?: string;
  @IsOptional() @IsString() dataHoraInicialAtendimento?: string;
  @IsOptional() @IsString() dataHoraFinalAtendimento?: string;
  /** Substitui condutas tiposEncamOdonto. */
  @IsOptional() @IsArray() tiposEncamOdonto?: number[];
  /** Condutas FAI (TipoEncaminhamentoIndividual). */
  @IsOptional() @IsArray() condutas?: number[];
  @IsOptional() @IsInt() tipoAtendimento?: number;
  /** Ficha Procedimentos: lista SIGTAP 10 dígitos (tags &lt;procedimentos&gt;). */
  @IsOptional() @IsArray() @IsString({ each: true }) procedimentosCodes?: string[];
  /** Substitui o XML inteiro (edição avançada). */
  @IsOptional() @IsString() xml?: string;
  /** Optimistic lock — versão lida no GET do item. */
  @IsOptional() @IsInt() expectedVersion?: number;
}

export class HomeCareProblemaDto {
  @IsOptional() @IsString() ciap?: string;
  @IsOptional() @IsString() cid?: string;
  /** Alias UI (`CodeSearchSelect` CID-10) — normalizado para `cid` no mapper */
  @IsOptional() @IsString() cid10?: string;
}

/** Child LEDI da ficha AD (1 cidadão / atendimento). */
export class HomeCareChildDto {
  @IsString() patientId!: string;
  /** AD1 | AD2 | AD3 — herda da visita se omitido */
  @IsOptional() @IsString() careType?: string;
  @IsOptional() @IsString() shift?: string;
  @IsOptional() @IsString() careLocation?: string;
  /** ATENDIMENTO_PROGRAMADO | ATENDIMENTO_NAO_PROGRAMADO | VISITA_DOMICILIAR_POS_OBITO */
  @IsOptional() @IsString() encounterType?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) procedures?: string[];
  @IsOptional() @IsString() desfecho?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsArray() @IsInt({ each: true }) condicoesAvaliadas?: number[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HomeCareProblemaDto)
  problemasCondicoes?: HomeCareProblemaDto[];
}

export class CreateHomeCareVisitDto {
  /** Paciente âncora — obrigatório se patientIds/children vazios */
  @ValidateIf((o: CreateHomeCareVisitDto) => !o.patientIds?.length && !o.children?.length)
  @IsString()
  patientId?: string;
  /** Atalho multi-child: mesmos defaults da visita para cada paciente */
  @IsOptional() @IsArray() @IsString({ each: true }) patientIds?: string[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HomeCareChildDto)
  children?: HomeCareChildDto[];
  @IsString() facilityId!: string;
  @IsOptional() @IsString() professionalId?: string;
  /** AD1 | AD2 | AD3 */
  @IsOptional() @IsString() careType?: string;
  @IsOptional() @IsString() shift?: string;
  @IsOptional() @IsString() careLocation?: string;
  @IsOptional() @IsString() encounterType?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) procedures?: string[];
  @IsOptional() @IsArray() @IsInt({ each: true }) condicoesAvaliadas?: number[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HomeCareProblemaDto)
  problemasCondicoes?: HomeCareProblemaDto[];
  @IsOptional() @IsDateString() visitedAt?: string;
}

export class AddHomeCareChildDto extends HomeCareChildDto {}

export class FinishHomeCareVisitDto {
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) procedures?: string[];
  @IsOptional() @IsDateString() finishedAt?: string;
  /** PERMANENCIA | ALTA | … — default dos children sem desfecho próprio */
  @IsOptional() @IsString() desfecho?: string;
  @IsOptional() @IsString() careLocation?: string;
  @IsOptional() @IsString() encounterType?: string;
  @IsOptional() @IsArray() @IsInt({ each: true }) condicoesAvaliadas?: number[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HomeCareProblemaDto)
  problemasCondicoes?: HomeCareProblemaDto[];
  /** Substitui children persistidos no finish (opcional) */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HomeCareChildDto)
  children?: HomeCareChildDto[];
  @IsOptional() @IsString() assignmentId?: string;
  @IsOptional() @IsString() cbo?: string;
}

export class CreateCollectiveActivityDto {
  @IsString() facilityId!: string;
  @IsOptional() @IsString() professionalId?: string;
  @IsOptional() @IsString() teamId?: string;
  /** EDUCACAO_SAUDE | REUNIAO | OUTRO */
  @IsString() activityType!: string;
  @IsString() theme!: string;
  @IsString() audience!: string;
  @IsOptional() @IsString() shift?: string;
  @IsOptional() @IsInt() @Min(0) participantCount?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) participantIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) procedures?: string[];
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsDateString() heldAt?: string;
}

export class FinishCollectiveActivityDto {
  @IsOptional() @IsInt() @Min(1) participantCount?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) procedures?: string[];
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsDateString() finishedAt?: string;
  @IsOptional() @IsString() assignmentId?: string;
  @IsOptional() @IsString() cbo?: string;
}
