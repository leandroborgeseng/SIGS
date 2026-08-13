import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ENCOUNTER_STATUS } from '../common/rf';

export class ApsProblemaDto {
  @IsOptional() @IsString() ciap?: string;
  @IsOptional() @IsString() cid10?: string;
}

export class ApsProcedimentoDto {
  @IsString() code!: string;
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsInt() @Min(1) quantidade?: number;
}

export class OpenEncounterDto {
  @IsString() patientId!: string;
  @IsString() facilityId!: string;
  @IsOptional() @IsString() professionalId?: string;
  @IsOptional() @IsString() teamId?: string;
  @IsOptional() @IsString() appointmentId?: string;
  @IsOptional() @IsString() careLocation?: string;
  @IsOptional() @IsString() shift?: string;
  @IsOptional() @IsString() encounterType?: string;
  @IsOptional() @IsBoolean() lateRegistration?: boolean;
  /** Lotação (CNS+CBO+CNES+INE) — padrão odonto */
  @IsOptional() @IsString() assignmentId?: string;
  @IsOptional() @IsString() cbo?: string;
  /** Abre ficha APS origem FAI tipo 4 (paralelo ao /odonto). */
  @IsOptional() @IsBoolean() faiOrigin?: boolean;
}

export class UpdateEncounterStatusDto {
  @IsIn([...ENCOUNTER_STATUS])
  status!: (typeof ENCOUNTER_STATUS)[number];
}

export class SaveClinicalDto {
  @IsOptional() @IsString() soapSubjective?: string;
  @IsOptional() @IsString() soapObjective?: string;
  @IsOptional() @IsString() soapAssessment?: string;
  @IsOptional() @IsString() soapPlan?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) ciapCodes?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) cidCodes?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) procedures?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) outcomes?: string[];
  @IsOptional() @IsNumber() @Min(0.5) @Max(500) weightKg?: number;
  @IsOptional() @IsNumber() @Min(20) @Max(250) heightCm?: number;
  @IsOptional() @IsNumber() @Min(10) @Max(200) headCircumferenceCm?: number;
  @IsOptional() @IsString() careLocation?: string;
  @IsOptional() @IsString() shift?: string;
  @IsOptional() @IsString() encounterType?: string;
  @IsOptional() @IsString() assignmentId?: string;
  @IsOptional() @IsString() cbo?: string;
  @IsOptional() @IsInt() tipoAtendimento?: number;
  @IsOptional() @IsInt() localAtendimento?: number;
  @IsOptional() @IsInt() turno?: number;
  @IsOptional() @IsBoolean() stNaoPossuiCpf?: boolean;
  @IsOptional() @IsInt() justificativaNaoPossuiCpf?: number;
  @IsOptional() @IsBoolean() gestante?: boolean;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApsProblemaDto)
  problemasCondicoes?: ApsProblemaDto[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApsProcedimentoDto)
  procedimentos?: ApsProcedimentoDto[];
}

export class FinishEncounterDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  outcomes!: string[];

  @IsOptional() @IsDateString() finishedAt?: string;
  /** Lotação explícita; senão resolve ativa profissional+unidade */
  @IsOptional() @IsString() assignmentId?: string;
  /** CBO 2002 se não houver lotação ativa */
  @IsOptional() @IsString() cbo?: string;
  /** Default true na origem FAI — bloqueia finish com BLOCKER */
  @IsOptional() @IsBoolean() enforceFaiConformity?: boolean;
}
