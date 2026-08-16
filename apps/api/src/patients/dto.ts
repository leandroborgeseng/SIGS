import { IsArray, IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePatientDto {
  @IsString() civilName!: string;
  @IsOptional() @IsString() socialName?: string;
  @IsOptional() @IsString() @MaxLength(11) cpf?: string;
  @IsOptional() @IsString() @MaxLength(16) cns?: string;
  @IsDateString() birthDate!: string;
  @IsString() sex!: string;
  @IsOptional() @IsString() raceColor?: string;
  @IsOptional() @IsString() motherName?: string;
  @IsOptional() @IsBoolean() motherNameUnknown?: boolean;
  @IsOptional() @IsString() fatherName?: string;
  @IsOptional() @IsBoolean() fatherNameUnknown?: boolean;
  @IsOptional() @IsBoolean() isDeceased?: boolean;
  @IsOptional() @IsDateString() deathDate?: string;
  @IsOptional() @IsString() deathCertificate?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() addressStreet?: string;
  @IsOptional() @IsString() addressNumber?: string;
  @IsOptional() @IsString() addressComplement?: string;
  @IsOptional() @IsString() addressNeighborhood?: string;
  @IsOptional() @IsString() addressCity?: string;
  @IsOptional() @IsString() @MaxLength(2) addressState?: string;
  @IsOptional() @IsString() @MaxLength(8) addressZip?: string;
  /** BRASILEIRA | NATURALIZADA | ESTRANGEIRA */
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsString() @MaxLength(7) birthMunicipalityIbge?: string;
  @IsOptional() @IsString() ethnicity?: string;
  @IsOptional() @IsBoolean() hasDisability?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) disabilityCodes?: string[];
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() @MaxLength(11) nis?: string;
  @IsOptional() @IsString() educationLevel?: string;
}

export class UpdatePatientDto {
  @IsOptional() @IsString() civilName?: string;
  @IsOptional() @IsString() socialName?: string;
  @IsOptional() @IsString() @MaxLength(11) cpf?: string;
  @IsOptional() @IsString() @MaxLength(16) cns?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsString() sex?: string;
  @IsOptional() @IsString() raceColor?: string;
  @IsOptional() @IsString() motherName?: string;
  @IsOptional() @IsBoolean() motherNameUnknown?: boolean;
  @IsOptional() @IsString() fatherName?: string;
  @IsOptional() @IsBoolean() fatherNameUnknown?: boolean;
  @IsOptional() @IsBoolean() isDeceased?: boolean;
  @IsOptional() @IsDateString() deathDate?: string;
  @IsOptional() @IsString() deathCertificate?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() addressStreet?: string;
  @IsOptional() @IsString() addressNumber?: string;
  @IsOptional() @IsString() addressComplement?: string;
  @IsOptional() @IsString() addressNeighborhood?: string;
  @IsOptional() @IsString() addressCity?: string;
  @IsOptional() @IsString() @MaxLength(2) addressState?: string;
  @IsOptional() @IsString() @MaxLength(8) addressZip?: string;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsString() @MaxLength(7) birthMunicipalityIbge?: string;
  @IsOptional() @IsString() ethnicity?: string;
  @IsOptional() @IsBoolean() hasDisability?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) disabilityCodes?: string[];
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() @MaxLength(11) nis?: string;
  @IsOptional() @IsString() educationLevel?: string;
}
