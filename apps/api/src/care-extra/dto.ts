import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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
  @IsOptional() @IsString() encounterType?: string;
  @IsOptional() @IsString() anamnese?: string;
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

export class FinishDentalEncounterDto {
  @IsArray() @IsString({ each: true }) outcomes!: string[];
  @IsOptional() @IsDateString() finishedAt?: string;
  @IsOptional() @IsString() assignmentId?: string;
  @IsOptional() @IsString() cbo?: string;
  /** 2|4|5|6 — LEDI tipoAtendimento */
  @IsOptional() @IsInt() tipoAtendimento?: number;
  @IsOptional() @IsString() shift?: string;
  @IsOptional() @IsString() careLocation?: string;
  @IsOptional() @IsBoolean() gestante?: boolean;
  @IsOptional() @IsBoolean() necessidadesEspeciais?: boolean;
  /** Códigos vigilância saúde bucal (FAO#10) — obrigatório para conformidade */
  @IsOptional() @IsArray() vigilanciaSaudeBucal?: number[];
  @IsOptional() @IsArray() @IsString({ each: true }) fornecimentos?: string[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DentalProblemaDto)
  problemasCondicoes?: DentalProblemaDto[];
  @IsOptional() @IsBoolean() stNaoPossuiCpf?: boolean;
  @IsOptional() @IsInt() justificativaNaoPossuiCpf?: number;
  /** Se true, bloqueia finish quando validador FAO achar BLOCKER */
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
   * Default FAO para compatibilidade com /odonto/lote.
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

/** ZIP em base64 — evita multipart pelo proxy Next. */
export class CreateLediFaoBatchFromZipDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() expectedTipo?: 'FAO' | 'FAI' | 'PROCEDIMENTOS';
  @IsString() zipBase64!: string;
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
   * Se true (com onlyItemIds), aplica os campos de patch abaixo
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
  /** Ficha Procedimentos: lista SIGTAP 10 dígitos (tags &lt;procedimentos&gt;). */
  @IsOptional() @IsArray() @IsString({ each: true }) procedimentosCodes?: string[];
  /** Substitui o XML inteiro (edição avançada). */
  @IsOptional() @IsString() xml?: string;
  /** Optimistic lock — versão lida no GET do item. */
  @IsOptional() @IsInt() expectedVersion?: number;
}

export class CreateHomeCareVisitDto {
  @IsString() patientId!: string;
  @IsString() facilityId!: string;
  @IsOptional() @IsString() professionalId?: string;
  /** AD1 | AD2 | AD3 */
  @IsOptional() @IsString() careType?: string;
  @IsOptional() @IsString() shift?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) procedures?: string[];
  @IsOptional() @IsDateString() visitedAt?: string;
}

export class FinishHomeCareVisitDto {
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) procedures?: string[];
  @IsOptional() @IsDateString() finishedAt?: string;
  /** PERMANENCIA | ALTA | … */
  @IsOptional() @IsString() desfecho?: string;
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
