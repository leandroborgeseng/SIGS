import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { RF } from '../common/rf';
import { SIGTAP_BPA_STUB_CODES, SIGTAP_SEED, SIGTAP_SEED_COMPETENCIA } from './seed';
import { ImportSigtapDto, ImportSigtapMsDto, ValidateSigtapDto } from './dto';
import { parseTbProcedimentoText } from './ms-procedimento.parser';
import {
  discoverDefaultSigtapFile,
  extractTbProcedimentoFromBuffer,
  loadSigtapLocalFile,
  parseSigtapCsv,
  resolveSigtapDataDir,
} from './local-file.loader';
import type { MsProcedimentoRow } from './ms-procedimento.parser';

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

  private async upsertMsRows(rows: MsProcedimentoRow[], competencia: string, source: 'ms' | 'import') {
    let upserted = 0;
    for (const item of rows) {
      await this.prisma.sigtapProcedure.upsert({
        where: { code: item.code },
        create: {
          code: item.code,
          name: item.name,
          groupCode: item.groupCode,
          groupName: item.groupName,
          complex: item.complex,
          active: true,
          source,
          competencia: item.competencia || competencia,
        },
        update: {
          name: item.name,
          groupCode: item.groupCode,
          groupName: item.groupName,
          complex: item.complex,
          active: true,
          source,
          competencia: item.competencia || competencia,
        },
      });
      upserted += 1;
    }
    return upserted;
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

    const upserted = await this.upsertMsRows(parsed.rows, competencia, 'ms');

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

  /**
   * Import multipart: ZIP oficial (extrai TB_PROCEDIMENTO.txt) ou TXT/CSV.
   * Caminho offline — não baixa do site.
   */
  async importMsUpload(
    file: { buffer: Buffer; originalname?: string },
    opts?: { competencia?: string; maxRows?: number },
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('arquivo vazio');
    if (file.buffer.length > 40_000_000) {
      throw new BadRequestException('arquivo muito grande (máx. ~40 MB neste MVP)');
    }
    const name = file.originalname || 'upload.txt';
    const lower = name.toLowerCase();

    if (lower.endsWith('.csv')) {
      const rows = parseSigtapCsv(file.buffer.toString('utf8'), opts?.competencia);
      if (!rows.length) throw new BadRequestException('CSV sem linhas válidas');
      const competencia =
        opts?.competencia || rows.find((r) => r.competencia)?.competencia || new Date().toISOString().slice(0, 7).replace('-', '');
      const upserted = await this.upsertMsRows(rows.slice(0, opts?.maxRows ?? 50_000), competencia, 'import');
      await this.prisma.audit('import_csv', 'sigtap', name, [RF.SIGTAP.id, RF.SIGTAP_IMPORT.id], {
        upserted,
        competencia,
      });
      return { upserted, skipped: 0, competencia, source: 'import' as const, format: 'CSV', filename: name };
    }

    const { content, fromZip } = await extractTbProcedimentoFromBuffer(file.buffer, name);
    const result = await this.importMsProcedimento({
      content,
      competencia: opts?.competencia,
      maxRows: opts?.maxRows,
    });
    return { ...result, fromZip, filename: name, format: fromZip ? 'ZIP/TB_PROCEDIMENTO' : result.format };
  }

  /** Importa arquivo já colocado em data/sigtap/ (ou path absoluto). */
  async importFromLocalPath(opts?: { file?: string; competencia?: string; maxRows?: number }) {
    const file =
      opts?.file ||
      process.env.SIGTAP_FILE ||
      discoverDefaultSigtapFile(resolveSigtapDataDir() || undefined);
    if (!file) {
      throw new BadRequestException(
        'Nenhum arquivo em data/sigtap/ — coloque TabelaUnificada_*.zip ou TB_PROCEDIMENTO.txt',
      );
    }
    try {
      const loaded = await loadSigtapLocalFile(file, { competenciaFallback: opts?.competencia });
      if (loaded.kind === 'json_stub' && loaded.json) {
        const dto: ImportSigtapDto = {
          competencia: loaded.json.competencia || opts?.competencia,
          items: loaded.json.items.map((it) => ({
            code: String(it.code || ''),
            name: String(it.name || ''),
            complex: it.complex ? String(it.complex) : undefined,
            groupCode: it.groupCode ? String(it.groupCode) : undefined,
            groupName: it.groupName ? String(it.groupName) : undefined,
            active: true,
          })),
        };
        const out = await this.importBatch(dto);
        return { ...out, file, kind: loaded.kind, source: 'import' as const };
      }
      if (loaded.kind === 'csv' && loaded.csvRows) {
        const competencia =
          opts?.competencia ||
          loaded.detectedCompetencia ||
          new Date().toISOString().slice(0, 7).replace('-', '');
        const upserted = await this.upsertMsRows(
          loaded.csvRows.slice(0, opts?.maxRows ?? 50_000),
          competencia,
          'import',
        );
        return {
          upserted,
          competencia,
          file,
          kind: loaded.kind,
          source: 'import' as const,
          format: 'CSV',
        };
      }
      if (!loaded.content) throw new BadRequestException('conteúdo vazio');
      const result = await this.importMsProcedimento({
        content: loaded.content,
        competencia: opts?.competencia,
        maxRows: opts?.maxRows,
      });
      return { ...result, file, kind: loaded.kind };
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException((e as Error).message);
    }
  }

  /** Mapa piloto ABPG→SIGTAP (município preenche; sem inventar equivalências oficiais). */
  abpgMap() {
    const dir = resolveSigtapDataDir();
    const candidates = [
      process.env.SIGTAP_ABPG_MAP,
      dir ? join(dir, 'abpg-map-piloto.json') : null,
      join(process.cwd(), 'data', 'sigtap', 'abpg-map-piloto.json'),
      join(process.cwd(), '..', '..', 'data', 'sigtap', 'abpg-map-piloto.json'),
    ].filter(Boolean) as string[];
    for (const p of candidates) {
      const abs = resolve(p);
      if (!existsSync(abs)) continue;
      const raw = JSON.parse(readFileSync(abs, 'utf8')) as {
        competencia?: string;
        nota?: string;
        mappings?: Array<{ abpg: string; sigtap: string | null; label?: string }>;
      };
      return {
        path: abs,
        competencia: raw.competencia || null,
        nota: raw.nota || null,
        mappings: Array.isArray(raw.mappings) ? raw.mappings : [],
        filled: (raw.mappings || []).filter((m) => m.sigtap && /^\d{10}$/.test(m.sigtap)).length,
      };
    }
    return {
      path: null,
      competencia: null,
      nota: 'Arquivo data/sigtap/abpg-map-piloto.json ausente',
      mappings: [] as Array<{ abpg: string; sigtap: string | null; label?: string }>,
      filled: 0,
    };
  }

  offlineStatus() {
    const dir = resolveSigtapDataDir();
    const discovered = discoverDefaultSigtapFile(dir || undefined);
    return {
      dataDir: dir,
      discoveredFile: discovered,
      hint: discovered
        ? 'Pronto para npm run sync:sigtap ou POST /v1/sigtap/import-local'
        : 'Coloque ZIP/TXT em data/sigtap/ — ver data/sigtap/README.md',
      abpgMap: this.abpgMap().path,
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
