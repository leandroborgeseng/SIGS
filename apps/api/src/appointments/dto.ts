import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { APPOINTMENT_STATUS } from '../common/rf';

export class CreateSlotDto {
  @IsString() professionalId!: string;
  @IsOptional() @IsString() facilityId?: string;
  @IsOptional() @IsString() patientId?: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateSlotStatusDto {
  @IsIn([...APPOINTMENT_STATUS])
  status!: (typeof APPOINTMENT_STATUS)[number];
}

export class BookSlotDto {
  @IsString() patientId!: string;
}
