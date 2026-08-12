import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const REGULATION_PRIORITIES = ['ELETIVO', 'PRIORITARIO', 'URGENTE'] as const;
export const REGULATION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'CLASSIFIED',
  'AUTHORIZED',
  'DENIED',
  'RETURNED',
  'SCHEDULED',
  'CLOSED',
] as const;
export const REGULATION_CLASSES = ['VERDE', 'AMARELO', 'VERMELHO', 'AZUL'] as const;

export class CreateRegulationRequestDto {
  @IsString() patientId!: string;
  @IsString() facilityId!: string;
  @IsOptional() @IsString() professionalId?: string;
  @IsOptional() @IsString() encounterId?: string;
  @IsString() @MaxLength(40) procedureCode!: string;
  @IsOptional() @IsString() @MaxLength(200) procedureName?: string;
  @IsOptional() @IsString() @MaxLength(16) cid?: string;
  @IsOptional() @IsString() clinicalSummary?: string;
  @IsOptional() @IsIn([...REGULATION_PRIORITIES]) priority?: (typeof REGULATION_PRIORITIES)[number];
  /** Se true (padrão), já envia à fila (SUBMITTED). */
  @IsOptional() @IsBoolean() @Type(() => Boolean) submit?: boolean;
}

export class ClassifyRegulationDto {
  @IsIn([...REGULATION_CLASSES]) classification!: (typeof REGULATION_CLASSES)[number];
  @IsOptional() @IsIn([...REGULATION_PRIORITIES]) priority?: (typeof REGULATION_PRIORITIES)[number];
  @IsOptional() @IsString() notes?: string;
}

export class AuthorizeRegulationDto {
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsDateString() scheduledHint?: string;
}

export class DenyRegulationDto {
  @IsString() reason!: string;
  @IsOptional() @IsString() notes?: string;
}

export class ReturnRegulationDto {
  @IsString() reason!: string;
}

export class CloseRegulationDto {
  @IsOptional() @IsString() notes?: string;
}
