import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class VaccineApplicationDto {
  @IsString() immunobiologicalId!: string;
  @IsString() strategyId!: string;
  @IsString() doseId!: string;
  @IsString() attendanceGroupId!: string;
  @IsString() @MaxLength(30) lot!: string;
  @IsString() manufacturer!: string;
  @IsString() routeId!: string;
  @IsString() siteId!: string;
  @IsOptional() @IsString() prescriberCbo?: string;
  @IsOptional() @IsString() indicationCid10?: string;
  @IsOptional() @IsBoolean() leprosyContact?: boolean;
  @IsOptional() @IsBoolean() isClinicalResearch?: boolean;
  @IsOptional() @IsString() anvisaStudyProtocol?: string;
  @IsOptional() @IsString() anvisaProtocolVersion?: string;
  @IsOptional() @IsString() anvisaRegistrationNumber?: string;
  @IsOptional() @IsBoolean() appliedAbroad?: boolean;
}

export class CreateVaccinationDto {
  @IsString() patientId!: string;
  @IsString() facilityId!: string;
  @IsOptional() @IsString() professionalId?: string;
  @IsOptional() @IsString() teamId?: string;
  @IsOptional() @IsString() assignmentId?: string;
  @IsOptional() @IsString() cbo?: string;
  @IsString() shift!: string;
  @IsString() careLocation!: string;
  @IsOptional() @IsDateString() appliedAt?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VaccineApplicationDto)
  applications!: VaccineApplicationDto[];
}
