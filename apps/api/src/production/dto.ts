import { IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { BATCH_STATUSES } from './lifecycle';

export class EnqueueBatchDto {
  @IsString() kind!: string;
  @IsObject() payload!: Record<string, unknown>;
  @IsOptional() @IsArray() @IsString({ each: true }) rfIds?: string[];
  /** default ready; use draft para rascunho manual */
  @IsOptional()
  @IsIn([...BATCH_STATUSES])
  status?: (typeof BATCH_STATUSES)[number];
}

export class SendProductionDto {
  @IsOptional() @IsString() competencia?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) batchIds?: string[];
  /** Ignora bloqueios (ainda audita riscos). Use só com ciência do gestor. */
  @IsOptional() @IsBoolean() @Type(() => Boolean) force?: boolean;
  /** Se houver bloqueio e !force, marca esses lotes como error */
  @IsOptional() @IsBoolean() @Type(() => Boolean) markBlockedAsError?: boolean;
}

export class MarkSentDto {
  @IsOptional() @IsBoolean() @Type(() => Boolean) force?: boolean;
}

export class MarkErrorDto {
  @IsOptional() @IsString() @MaxLength(2000) message?: string;
}

export class ReprocessDto {
  /** Se ainda houver BLOCKER, mantém/marca error (default true) */
  @IsOptional() @IsBoolean() @Type(() => Boolean) markErrorIfBlocked?: boolean;
}
