import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export const QUEUE_SERVICE_TYPES = ['NORMAL', 'PRIORITARIO', 'VACINA', 'ODONTO', 'OUTRO'] as const;
export const QUEUE_TICKET_STATUS = ['WAITING', 'CALLED', 'COMPLETED', 'NO_SHOW', 'CANCELLED'] as const;

export class EmitTicketDto {
  @IsString() facilityId!: string;
  @IsIn([...QUEUE_SERVICE_TYPES]) serviceType!: (typeof QUEUE_SERVICE_TYPES)[number];
  @IsOptional() @IsString() patientId?: string;
  @IsOptional() @IsString() @MaxLength(120) displayName?: string;
}

export class CallTicketDto {
  @IsOptional() @IsString() @MaxLength(80) deskLabel?: string;
  @IsOptional() @IsString() professionalId?: string;
  /** Se true e houver patientId, abre encounter WAITING. */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  openEncounter?: boolean;
}

export class CallNextDto extends CallTicketDto {
  @IsString() facilityId!: string;
}

export class FinishTicketDto {
  @IsIn(['COMPLETED', 'NO_SHOW', 'CANCELLED'])
  status!: 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';
}
