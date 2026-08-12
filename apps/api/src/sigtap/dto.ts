import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ImportSigtapItemDto {
  @IsString() @MaxLength(20) code!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() complex?: string;
  @IsOptional() @IsString() groupCode?: string;
  @IsOptional() @IsString() groupName?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class ImportSigtapDto {
  @IsOptional() @IsString() competencia?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportSigtapItemDto)
  items!: ImportSigtapItemDto[];
}

export class ValidateSigtapDto {
  @IsArray()
  @IsString({ each: true })
  codes!: string[];
}

/** Conteúdo bruto de TB_PROCEDIMENTO.txt (layout largura fixa MS/DATASUS). */
export class ImportSigtapMsDto {
  @IsString()
  content!: string;

  @IsOptional() @IsString() competencia?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  maxRows?: number;
}
