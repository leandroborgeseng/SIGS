import { IsArray, IsDateString, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { APPOINTMENT_STATUS } from '../common/rf';
import { APPOINTMENT_CARE_LINES, APPOINTMENT_ITEM_TYPES } from './appointments.constants';

export class CreateSlotDto {
  @IsString() professionalId!: string;
  @IsOptional() @IsString() facilityId?: string;
  @IsOptional() @IsString() patientId?: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsOptional() @IsString() notes?: string;
  /** CONSULTA (tipoAtendimento=2) | ENCAIXE (tipoAtendimento=5) */
  @IsOptional() @IsIn([...APPOINTMENT_ITEM_TYPES]) itemType?: (typeof APPOINTMENT_ITEM_TYPES)[number];
  /** GENERAL | ODONTO | APS */
  @IsOptional() @IsIn([...APPOINTMENT_CARE_LINES]) careLine?: (typeof APPOINTMENT_CARE_LINES)[number];
}

export class UpdateSlotStatusDto {
  @IsIn([...APPOINTMENT_STATUS])
  status!: (typeof APPOINTMENT_STATUS)[number];
}

export class BookSlotDto {
  @IsString() patientId!: string;
}

class DentalProcedureOpenDto {
  @IsOptional() @IsString() tooth?: string;
  @IsOptional() @IsString() region?: string;
  @IsString() code!: string;
  @IsString() label!: string;
  @IsOptional() done?: boolean;
}

/** Abre DentalEncounter a partir do slot (RF-12.1). */
export class OpenDentalFromSlotDto {
  @IsOptional() @IsString() assignmentId?: string;
  @IsOptional() @IsString() cbo?: string;
  @IsOptional() @IsString() anamnese?: string;
  @IsOptional() @IsString() encounterType?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DentalProcedureOpenDto)
  procedures?: DentalProcedureOpenDto[];
}

/** Abre Encounter FAI (/aps) a partir do slot genérico. */
export class OpenApsFromSlotDto {
  @IsOptional() @IsString() assignmentId?: string;
  @IsOptional() @IsString() cbo?: string;
}
