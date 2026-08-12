import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFacilityDto {
  @IsString() @MaxLength(20) cnes!: string;
  @IsString() name!: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() @MaxLength(14) cnpj?: string;
  @IsOptional() @IsString() typeId?: string;
  /** Código IBGE município (7 dígitos), ex.: 3516200 Franca/SP */
  @IsOptional() @IsString() @MaxLength(20) ibgeCode?: string;
}

export class UpdateFacilityDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() @MaxLength(14) cnpj?: string;
  @IsOptional() @IsString() typeId?: string;
  @IsOptional() @IsString() @MaxLength(20) ibgeCode?: string;
}

export class CreateProfessionalDto {
  @IsString() civilName!: string;
  @IsOptional() @IsString() socialName?: string;
  @IsOptional() @IsString() @MaxLength(11) cpf?: string;
  @IsOptional() @IsString() @MaxLength(16) cns?: string;
}

export class CreateTeamDto {
  @IsString() facilityId!: string;
  @IsString() name!: string;
  @IsString() teamTypeId!: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() ine?: string;
}

export class CreateAssignmentDto {
  @IsString() professionalId!: string;
  @IsString() facilityId!: string;
  @IsOptional() @IsString() teamId?: string;
  @IsString() @MaxLength(10) cbo!: string;
  @IsOptional() @IsString() roleLabel?: string;
  @IsOptional() @IsDateString() startedAt?: string;
}

export class EndAssignmentDto {
  @IsOptional() @IsDateString() endedAt?: string;
}
