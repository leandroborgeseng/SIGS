import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RF } from '../common/rf';
import { SIGTAP_BPA_STUB_CODES, SIGTAP_SEED, SIGTAP_SEED_COMPETENCIA } from './seed';
import { ImportSigtapDto, ImportSigtapMsDto, ValidateSigtapDto } from './dto';
import { parseTbProcedimentoText } from './ms-procedimento.parser';

@Injectable()
export class SigtapService implements OnModuleInit {
  private readonly log = new Logger(SigtapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    if (process.env.SKIP_SIGTAP_SEED === '1') return;
    await this.ensureSeeded();
  }

  /**
   * Garante todos os códigos do SIGTAP_SEED no banco.
   * - cria ausentes
   * - atualiza linhas com source=seed (não sobrescreve import/ms)
   * - force=true atualiza também linhas seed já existentes com nomes novos
   */
  async ensureSeeded(opts?: { force?: boolean }) {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of SIGTAP_SEED) {
      const existing = await this.prisma.sigtapProcedure.findUnique({ where: { code: item.code } });
      if (!existing) {
        await this.prisma.sigtapProcedure.create({
          data: {
            code: item.code,
            name: item.name,
            complex: item.complex,
            groupCode: item.groupCode,
            groupName: item.groupName,
            active: true,
            source: 'seed',
            competencia: SIGTAP_SEED_COMPETENCIA,
          },
        });
        created += 1;
        continue;
      }
      if (existing.source !== 'seed') {
        skipped += 1;
        continue;
      }
      if (
        opts?.force ||
        existing.name !== item.name ||
        existing.complex !== item.complex ||
        existing.groupCode !== item.groupCode
      ) {
        await this.prisma.sigtapProcedure.update({
          where: { code: item.code },
          data: {
            name: item.name,
            complex: item.complex,
            groupCode: item.groupCode,
            groupName: item.groupName,
            active: true,
            competencia: SIGTAP_SEED_COMPETENCIA,
            source: 'seed',
          },
        });
        updated += 1;
      } else {
        skipped += 1;
      }
    }

    const count = await this.prisma.sigtapProcedure.count();
    if (created || updated) {
      this.log.log(
        `SIGTAP seed sync: +${created} criados, ~${updated} atualizados, ${skipped} mantidos (total ${count})`,
      );
    }
    return {
      seeded: created > 0 || updated > 0,
      created,
      updated,
      skipped,
      count,
      seedSize: SIGTAP_SEED.length,
      bpaStubCodes: [...SIGTAP_BPA_STUB_CODES],
      competencia: SIGTAP_SEED_COMPETENCIA,
    };
  }

  catalogSeed() {
    return {
      competencia: SIGTAP_SEED_COMPETENCIA,
      total: SIGTAP_SEED.length,
      bpaStubCodes: [...SIGTAP_BPA_STUB_CODES],
      items: SIGTAP_SEED.map(({ tags, ...rest }) => ({ ...rest, tags: tags || [] })),
      pilotoJsonPath: 'data/sigtap/piloto-franca.json',
    };
  }

  search(q?: string, activeOnly = true) {
    return this.prisma.sigtapProcedure.findMany({
      where: {
        ...(activeOnly ? { active: true } : {}),
        ...(q
          ? {
              OR: [{ code: { contains: q } }, { name: { contains: q } }, { groupName: { contains: q } }],
            }
          : {}),
      },
      orderBy: { code: 'asc' },
      take: 200,
    });
  }

  async getByCode(code: string) {
    const row = await this.prisma.sigtapProcedure.findUnique({ where: { code } });
    if (!row) throw new NotFoundException(`Procedimento SIGTAP ${code} não encontrado`);
    return row;
  }

  async importBatch(dto: ImportSigtapDto) {
    if (!dto.items?.length) throw new BadRequestException('items vazio');
    let upserted = 0;
    for (const item of dto.items) {
      const code = item.code.replace(/\D/g, '');
      if (code.length < 9 || code.length > 10) {
        throw new BadRequestException(`código inválido: ${item.code}`);
      }
      await this.prisma.sigtapProcedure.upsert({
        where: { code },
        create: {
          code,
          name: item.name,
          complex: item.complex,
          groupCode: item.groupCode,
          groupName: item.groupName,
          active: item.active ?? true,
          source: 'import',
          competencia: dto.competencia,
        },
        update: {
          name: item.name,
          complex: item.complex,
          groupCode: item.groupCode,
          groupName: item.groupName,
          active: item.active ?? true,
          source: 'import',
          competencia: dto.competencia,
        },
      });
      upserted += 1;
    }
    await this.prisma.audit('import', 'sigtap', 'batch', [RF.SIGTAP.id, RF.SIGTAP_IMPORT.id], {
      upserted,
      competencia: dto.competencia,
    });
    return { upserted, competencia: dto.competencia };
  }

  /** Importa TB_PROCEDIMENTO.txt do pacote oficial SIGTAP (DATASUS). */
  async importMsProcedimento(dto: ImportSigtapMsDto) {
    if (!dto.content?.trim()) throw new BadRequestException('content vazio');
    if (dto.content.length > 25_000_000) {
      throw new BadRequestException('arquivo muito grande (máx. ~25 MB neste MVP)');
    }

    const parsed = parseTbProcedimentoText(dto.content, {
      competenciaFallback: dto.competencia,
      maxRows: dto.maxRows ?? 50_000,
    });
    if (!parsed.rows.length) {
      throw new BadRequestException(
        'Nenhum procedimento reconhecido — envie TB_PROCEDIMENTO.txt (layout largura fixa MS)',
      );
    }

    const competencia =
      dto.competencia || parsed.detectedCompetencia || new Date().toISOString().slice(0, 7).replace('-', '');

    let upserted = 0;
    for (const item of parsed.rows) {
      await this.prisma.sigtapProcedure.upsert({
        where: { code: item.code },
        create: {
          code: item.code,
          name: item.name,
          groupCode: item.groupCode,
          groupName: item.groupName,
          complex: item.complex,
          active: true,
          source: 'ms',
          competencia: item.competencia || competencia,
        },
        update: {
          name: item.name,
          groupCode: item.groupCode,
          groupName: item.groupName,
          complex: item.complex,
          active: true,
          source: 'ms',
          competencia: item.competencia || competencia,
        },
      });
      upserted += 1;
    }

    await this.prisma.audit('import_ms', 'sigtap', 'tb_procedimento', [RF.SIGTAP.id, RF.SIGTAP_IMPORT.id], {
      upserted,
      skipped: parsed.skipped,
      competencia,
      detectedCompetencia: parsed.detectedCompetencia,
    });

    this.log.log(`SIGTAP MS import: ${upserted} procedimentos (competência ${competencia})`);
    return {
      upserted,
      skipped: parsed.skipped,
      competencia,
      detectedCompetencia: parsed.detectedCompetencia,
      source: 'ms' as const,
      format: 'TB_PROCEDIMENTO',
    };
  }

  async validateCodes(dto: ValidateSigtapDto) {
    const codes = [...new Set(dto.codes.map((c) => c.trim()).filter(Boolean))];
    const found = await this.prisma.sigtapProcedure.findMany({
      where: { code: { in: codes }, active: true },
    });
    const byCode = new Map(found.map((f) => [f.code, f]));
    const results = codes.map((code) => {
      const row = byCode.get(code);
      return {
        code,
        valid: !!row,
        name: row?.name || null,
        complex: row?.complex || null,
      };
    });
    await this.prisma.audit('validate', 'sigtap', 'batch', [RF.SIGTAP_VALIDATE.id], {
      total: codes.length,
      valid: results.filter((r) => r.valid).length,
    });
    return {
      total: results.length,
      valid: results.filter((r) => r.valid).length,
      invalid: results.filter((r) => !r.valid).length,
      results,
    };
  }

  /** Enriquece linhas BPA com nome oficial do catálogo local. */
  async enrichProcedureCodes(codes: string[]) {
    const unique = [...new Set(codes.filter(Boolean))];
    const rows = await this.prisma.sigtapProcedure.findMany({
      where: { code: { in: unique } },
    });
    const map = new Map(rows.map((r) => [r.code, r]));
    return Object.fromEntries(
      unique.map((code) => [
        code,
        {
          code,
          known: map.has(code),
          name: map.get(code)?.name || null,
          active: map.get(code)?.active ?? false,
        },
      ]),
    );
  }
}
