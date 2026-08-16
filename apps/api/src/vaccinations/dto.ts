import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
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
  /** Validade do lote (ISO date) — RF-14.14 parcial */
  @IsOptional() @IsDateString() lotExpiry?: string;
}

export class VoidVaccinationDto {
  @IsOptional() @IsString() reason?: string;
  /** Obrigatório: anulação só local (sem recall Ministério/Siaps). */
  @IsOptional() @IsBoolean() acknowledgeLocalOnly?: boolean;
}

export class CreateVaccinationStockDto {
  @IsString() facilityId!: string;
  @IsString() immunobiologicalId!: string;
  @IsString() @MaxLength(30) lot!: string;
  @IsOptional() @IsString() manufacturer?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
  @IsOptional() @IsString() unit?: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  targetTempMinC?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  targetTempMaxC?: number;
  @IsOptional() @IsString() roomLabel?: string;
  /** Equipamento frio cadastrado (RF-14.17) */
  @IsOptional() @IsString() coldEquipmentId?: string;
  @IsOptional() @IsString() note?: string;
}

export class CreateColdEquipmentDto {
  @IsString() facilityId!: string;
  @IsString() @MaxLength(40) code!: string;
  @IsString() @MaxLength(120) label!: string;
  @IsOptional() @IsString() kind?: string;
  @Type(() => Number)
  @IsNumber()
  targetTempMinC!: number;
  @Type(() => Number)
  @IsNumber()
  targetTempMaxC!: number;
  @IsOptional() @IsString() status?: string;
}

export class PatchColdEquipmentDto {
  @IsOptional() @IsString() @MaxLength(120) label?: string;
  @IsOptional() @IsString() kind?: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  targetTempMinC?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  targetTempMaxC?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateThermalBoxDto {
  @IsString() facilityId!: string;
  @IsString() @MaxLength(40) code!: string;
  @IsString() @MaxLength(120) label!: string;
  @IsOptional() @IsString() coldEquipmentId?: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  targetTempMinC?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  targetTempMaxC?: number;
  @IsOptional() @IsString() status?: string;
}

export class PatchThermalBoxDto {
  @IsOptional() @IsString() @MaxLength(120) label?: string;
  @IsOptional() @IsString() coldEquipmentId?: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  targetTempMinC?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  targetTempMaxC?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateTempReadingDto {
  @IsString() facilityId!: string;
  @IsOptional() @IsString() coldEquipmentId?: string;
  @IsOptional() @IsString() thermalBoxId?: string;
  @Type(() => Number)
  @IsNumber()
  temperatureC!: number;
  @IsOptional() @IsDateString() recordedAt?: string;
  @IsOptional() @IsString() note?: string;
}

export class CreateSupplyDto {
  @IsString() facilityId!: string;
  @IsString() @MaxLength(40) sku!: string;
  @IsString() @MaxLength(120) label!: string;
  @IsOptional() @IsString() unit?: string;
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity!: number;
}

export class SupplyEntryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
  @IsOptional() @IsString() note?: string;
}

export class CreateSupplyLinkDto {
  @IsString() immunobiologicalId!: string;
  @IsString() supplyId!: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qtyPerDose?: number;
}

export class SyncVaccinationCatalogDto {
  @IsOptional() @IsBoolean() reset?: boolean;
  @IsOptional()
  @IsArray()
  immunobiologicals?: Array<{ id: string; label: string; code?: string; lediId: number }>;
  @IsOptional()
  @IsArray()
  ageRanges?: Array<{
    immunobiologicalId: string;
    strategyId?: string;
    minDays: number;
    maxDays: number | null;
    label: string;
  }>;
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
