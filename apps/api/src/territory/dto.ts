import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

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

export class UpdatePatientTeamLinkDto {
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() microAreaId?: string | null;
}

export class FamilyMemberInputDto {
  @IsString() patientId!: string;
  @IsOptional() @IsString() relationship?: string;
}

export class CreateFamilyNestedDto {
  @IsString() responsiblePatientId!: string;
  @IsOptional() @IsInt() @Min(1) membersCount?: number;
  @IsOptional() @IsInt() householdIncomeCode?: number;
  @IsOptional() @IsString() residingSince?: string;
  @IsOptional() @IsString() prontuarioNumber?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FamilyMemberInputDto)
  members?: FamilyMemberInputDto[];
}

export class CreateHouseholdDto {
  @IsString() teamId!: string;
  @IsOptional() @IsString() microAreaId?: string;
  @IsOptional() @IsInt() @Min(1) propertyType?: number;
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() complement?: string;
  @IsOptional() @IsString() neighborhood?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() @MaxLength(2) state?: string;
  @IsOptional() @IsString() zip?: string;
  @IsOptional() @IsString() municipalityIbge?: string;
  @IsOptional() @IsInt() locationType?: number;
  @IsOptional() @IsInt() dwellingType?: number;
  @IsOptional() @IsInt() ownershipStatus?: number;
  @IsOptional() @IsInt() waterSupply?: number;
  @IsOptional() @IsInt() waterConsumption?: number;
  @IsOptional() @IsInt() sewageDisposal?: number;
  @IsOptional() @IsInt() wasteDisposal?: number;
  @IsOptional() @IsBoolean() electricity?: boolean;
  @IsOptional() @IsInt() @Min(0) roomsCount?: number;
  @IsOptional() @IsInt() @Min(0) residentsCount?: number;
  @IsOptional() @IsBoolean() hasAnimals?: boolean;
  @IsOptional() @IsInt() @Min(0) animalsCount?: number;
  @IsOptional() @IsBoolean() refusalTerm?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() notes?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateFamilyNestedDto)
  family?: CreateFamilyNestedDto;
}

export class UpdateHouseholdDto {
  @IsOptional() @IsString() microAreaId?: string | null;
  @IsOptional() @IsInt() @Min(1) propertyType?: number;
  @IsOptional() @IsString() street?: string | null;
  @IsOptional() @IsString() number?: string | null;
  @IsOptional() @IsString() complement?: string | null;
  @IsOptional() @IsString() neighborhood?: string | null;
  @IsOptional() @IsString() city?: string | null;
  @IsOptional() @IsString() @MaxLength(2) state?: string | null;
  @IsOptional() @IsString() zip?: string | null;
  @IsOptional() @IsString() municipalityIbge?: string | null;
  @IsOptional() @IsInt() locationType?: number | null;
  @IsOptional() @IsInt() dwellingType?: number | null;
  @IsOptional() @IsInt() ownershipStatus?: number | null;
  @IsOptional() @IsInt() waterSupply?: number | null;
  @IsOptional() @IsInt() waterConsumption?: number | null;
  @IsOptional() @IsInt() sewageDisposal?: number | null;
  @IsOptional() @IsInt() wasteDisposal?: number | null;
  @IsOptional() @IsBoolean() electricity?: boolean | null;
  @IsOptional() @IsInt() @Min(0) roomsCount?: number | null;
  @IsOptional() @IsInt() @Min(0) residentsCount?: number | null;
  @IsOptional() @IsBoolean() hasAnimals?: boolean;
  @IsOptional() @IsInt() @Min(0) animalsCount?: number | null;
  @IsOptional() @IsBoolean() refusalTerm?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() notes?: string | null;
}

export class CreateHouseholdFamilyDto {
  @IsString() responsiblePatientId!: string;
  @IsOptional() @IsInt() @Min(1) membersCount?: number;
  @IsOptional() @IsInt() householdIncomeCode?: number;
  @IsOptional() @IsString() residingSince?: string;
  @IsOptional() @IsString() prontuarioNumber?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FamilyMemberInputDto)
  members?: FamilyMemberInputDto[];
}

export class UpdateHouseholdFamilyDto {
  @IsOptional() @IsString() responsiblePatientId?: string;
  @IsOptional() @IsInt() @Min(1) membersCount?: number | null;
  @IsOptional() @IsInt() householdIncomeCode?: number | null;
  @IsOptional() @IsString() residingSince?: string | null;
  @IsOptional() @IsString() prontuarioNumber?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class AddFamilyMemberDto {
  @IsString() patientId!: string;
  @IsOptional() @IsString() relationship?: string;
}

export class UpdateFamilyMemberDto {
  @IsOptional() @IsString() relationship?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateAcsHomeVisitDto {
  @IsString() facilityId!: string;
  @IsOptional() @IsString() teamId?: string;
  @IsOptional() @IsString() microAreaId?: string;
  @IsOptional() @IsString() householdId?: string;
  @IsOptional() @IsString() patientId?: string;
  @IsOptional() @IsString() professionalId?: string;
  @IsOptional() @IsString() shift?: string;
  @IsInt() @Min(1) @Max(3) desfecho!: number;
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  motivos!: number[];
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
  @IsOptional() @IsString() visitedAt?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateAcsHomeVisitDto {
  @IsOptional() @IsString() teamId?: string | null;
  @IsOptional() @IsString() microAreaId?: string | null;
  @IsOptional() @IsString() householdId?: string | null;
  @IsOptional() @IsString() patientId?: string | null;
  @IsOptional() @IsString() professionalId?: string | null;
  @IsOptional() @IsString() shift?: string;
  @IsOptional() @IsInt() @Min(1) @Max(3) desfecho?: number;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  motivos?: number[];
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number | null;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number | null;
  @IsOptional() @IsString() visitedAt?: string;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsString() status?: string;
}
