import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMicroAreaDto {
  @IsString() teamId!: string;
  @IsString() @MaxLength(16) code!: string;
  @IsString() name!: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreatePatientTeamLinkDto {
  @IsString() patientId!: string;
  @IsString() teamId!: string;
  @IsOptional() @IsString() microAreaId?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
