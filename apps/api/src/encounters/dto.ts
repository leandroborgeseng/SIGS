import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ENCOUNTER_STATUS } from '../common/rf';

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
}
