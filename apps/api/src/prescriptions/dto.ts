import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export const RECIPE_TYPES = ['COMUM', 'ESPECIAL', 'CONTROLE'] as const;

export class PrescriptionItemInputDto {
  @IsOptional() @IsString() medicationId?: string;
  @IsOptional() @IsString() @MaxLength(200) freeTextName?: string;
  @IsString() dose!: string;
  @IsString() frequency!: string;
  @IsOptional() @IsString() duration?: string;
  @IsOptional() @IsString() quantity?: string;
  @IsOptional() @IsString() route?: string;
  @IsOptional() @IsString() instructions?: string;
}

export class CreatePrescriptionDto {
  @IsString() patientId!: string;
  @IsString() facilityId!: string;
  @IsOptional() @IsString() professionalId?: string;
  @IsOptional() @IsString() encounterId?: string;
  @IsOptional() @IsIn([...RECIPE_TYPES]) recipeType?: (typeof RECIPE_TYPES)[number];
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsDateString() validUntil?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemInputDto)
  items!: PrescriptionItemInputDto[];
}

export class IssuePrescriptionDto {
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsBoolean() @Type(() => Boolean) forceOffCatalog?: boolean;
}
