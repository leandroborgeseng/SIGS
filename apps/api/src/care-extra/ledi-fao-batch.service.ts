import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RF } from '../common/rf';
import { validateFaoXml, type FaoFinding } from './ledi-fao.validator';
import { validateFaiXml } from './ledi-fai.validator';
import { validateProcXml } from './ledi-proc.validator';
import { extractFaoMasterFromXml } from './ledi-fao-xml.parser';
import {
  aggregatePrevineXrays,
  type PrevineXray,
} from './ledi-fao-previne-xray';
import { detectLediFichaTipo } from './ledi-ficha-tipo';
import {
  applyAutoFixes,
  classifyAutoFixable,
  addProcedimentos,
  addTiposEncamOdonto,
  fixCbo,
  fixCnes,
  fixGestante,
  fixIbge,
  fixIne,
  fixLocalAtendimento,
  fixTiposVigilanciaSaudeBucal,
  fixProblemasCondicoes,
  fixStNaoPossuiCpf,
  fixTiposConsultaOdonto,
  fixTurno,
  type AutoFixOptions,
} from './ledi-fao-xml.fixer';
import { buildStoreZip } from './zip-store';
import {
  CreateLediFaoBatchDto,
  PatchLediFaoBatchItemDto,
  AutoFixLediFaoBatchDto,
} from './dto';

type ItemSummary = {
  id: string;
  fileName: string;
  status: string;
  blockers: number;
  moneyRisks: number;
  qualityWarns: number;
  autoFixableCodes: string[];
  topCodes: string[];
  siapsReady: boolean;
  previneReady: boolean;
  readyForFinalSend: boolean;
  previneMoneyRisks: number;
  previneTopCodes: string[];
  fichaTipo?: string | null;
  fichaTipoCode?: number | null;
  fichaTipoLabel?: string | null;
};

type LediLoteTipo = 'FAO' | 'FAI' | 'PROCEDIMENTOS';

type UnifiedReport = {
  findings: FaoFinding[];
  siapsReady: boolean;
  previneReady: boolean;
  readyForFinalSend: boolean;
  previneXray?: PrevineXray;
};

@Injectable()
export class LediFaoBatchService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeExpectedTipo(raw?: string): LediLoteTipo {
    const t = (raw || 'FAO').toUpperCase();
    if (t === 'FAI') return 'FAI';
    if (t === 'PROCEDIMENTOS' || t === 'PROC') return 'PROCEDIMENTOS';
    return 'FAO';
  }

  private reportFromXml(xml: string, expectedTipo: LediLoteTipo = 'FAO'): UnifiedReport {
    if (expectedTipo === 'FAI') {
      const r = validateFaiXml(xml);
      return {
        findings: r.findings,
        siapsReady: r.siapsReady,
        previneReady: r.previneReady,
        readyForFinalSend: r.readyForFinalSend,
      };
    }
    if (expectedTipo === 'PROCEDIMENTOS') {
      const r = validateProcXml(xml);
      return {
        findings: r.findings,
        siapsReady: r.siapsReady,
        previneReady: r.previneReady,
        readyForFinalSend: r.readyForFinalSend,
      };
    }
    const r = validateFaoXml(xml);
    return {
      findings: r.findings,
      siapsReady: r.siapsReady,
      previneReady: r.previneReady,
      readyForFinalSend: r.readyForFinalSend,
      previneXray: r.previneXray,
    };
  }

  private findingsStatus(findings: FaoFinding[]): string {
    if (findings.some((f) => f.severity === 'BLOCKER' || f.severity === 'MONEY_RISK')) {
      return 'blocker';
    }
    if (findings.some((f) => f.severity === 'QUALITY_WARN')) return 'warn';
    return 'conformant';
  }

  private summarizeBatch(
    items: Array<{
      status: string;
      findingsJson: string;
      autoFixableCodes: string;
      previneJson?: string | null;
      fileName?: string;
      fichaTipo?: string | null;
    }>,
  ) {
    const codeFiles = new Map<string, number>();
    const tipoCounts = new Map<string, number>();
    let conformant = 0;
    let withBlockers = 0;
    let withWarn = 0;
    let autoFixableItems = 0;
    let siapsReady = 0;
    let previneReady = 0;
    let readyForFinalSend = 0;

    const xrayItems: Array<{ fileName: string; xray: PrevineXray }> = [];

    for (const it of items) {
      if (it.status === 'conformant' || it.status === 'fixed') conformant += 1;
      if (it.status === 'blocker') withBlockers += 1;
      if (it.status === 'warn') withWarn += 1;
      const codes = it.autoFixableCodes
        ? it.autoFixableCodes.split(',').filter(Boolean)
        : [];
      if (codes.length) autoFixableItems += 1;
      const findings = JSON.parse(it.findingsJson || '[]') as FaoFinding[];
      const seen = new Set<string>();
      for (const f of findings) {
        if (seen.has(f.code)) continue;
        seen.add(f.code);
        codeFiles.set(f.code, (codeFiles.get(f.code) || 0) + 1);
      }
      const hasBlocker = findings.some((f) => f.severity === 'BLOCKER');
      if (!hasBlocker) siapsReady += 1;

      const tipo = it.fichaTipo || 'UNKNOWN';
      tipoCounts.set(tipo, (tipoCounts.get(tipo) || 0) + 1);

      if (it.previneJson) {
        try {
          const xray = JSON.parse(it.previneJson) as PrevineXray;
          xrayItems.push({ fileName: it.fileName || 'item', xray });
          if (xray.summary.moneyRisks === 0) previneReady += 1;
          if (!hasBlocker && xray.summary.moneyRisks === 0) readyForFinalSend += 1;
        } catch {
          /* ignore */
        }
      }
    }

    const topCodes = [...codeFiles.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([code, files]) => ({ code, files, pct: Math.round((files / items.length) * 1000) / 10 }));

    const previne = xrayItems.length ? aggregatePrevineXrays(xrayItems) : null;

    return {
      total: items.length,
      conformant,
      withBlockers,
      withWarn,
      autoFixableItems,
      siapsReady,
      previneReady,
      readyForFinalSend,
      topCodes,
      previne,
      byTipo: [...tipoCounts.entries()]
        .map(([id, files]) => ({
          id,
          files,
          pct: Math.round((files / Math.max(items.length, 1)) * 1000) / 10,
        }))
        .sort((a, b) => b.files - a.files),
    };
  }

  private async expectedTipoOf(batchId: string): Promise<LediLoteTipo> {
    const batch = await this.prisma.lediFaoBatch.findUnique({
      where: { id: batchId },
      select: { summaryJson: true },
    });
    if (!batch) throw new NotFoundException('Lote não encontrado');
    const summary = JSON.parse(batch.summaryJson || '{}') as { expectedTipo?: string };
    return this.normalizeExpectedTipo(summary.expectedTipo);
  }

  private tipoMatchOk(detectedId: string, expected: LediLoteTipo): boolean {
    return detectedId === expected;
  }

  private prepareItems(
    files: Array<{ name: string; xml: string }>,
    expectedTipo: LediLoteTipo,
  ) {
    const label =
      expectedTipo === 'FAI'
        ? 'FAI'
        : expectedTipo === 'PROCEDIMENTOS'
          ? 'Procedimentos'
          : 'FAO';

    return files.map((f) => {
      const xml = f.xml?.trim();
      if (!xml) throw new BadRequestException(`Arquivo sem conteúdo: ${f.name}`);
      const tipo = detectLediFichaTipo(xml);
      const report = this.reportFromXml(xml, expectedTipo);
      const findings = [...report.findings];
      if (!this.tipoMatchOk(tipo.id, expectedTipo)) {
        findings.unshift({
          severity: 'BLOCKER',
          code: 'WRONG_FICHA_TIPO',
          message: `Arquivo é ${tipo.label} (tipo ${tipo.code ?? '?'}) — este lote espera ${label}.`,
          hint: tipo.correctionPath,
          field: 'tipoDadoSerializado',
          rule: 'LEDI-tipo',
        });
      }
      const auto = classifyAutoFixable(findings);
      let masterJson: string | null = null;
      if (expectedTipo === 'FAO') {
        try {
          const extracted = extractFaoMasterFromXml(xml);
          if (extracted.master) masterJson = JSON.stringify(extracted.master);
        } catch {
          masterJson = null;
        }
      }
      return {
        fileName: f.name.slice(0, 255),
        status: this.findingsStatus(findings),
        originalXml: xml,
        currentXml: xml,
        findingsJson: JSON.stringify(findings),
        previneJson: report.previneXray ? JSON.stringify(report.previneXray) : null,
        fichaTipo: tipo.id,
        fichaTipoCode: tipo.code,
        masterJson,
        autoFixableCodes: auto.join(','),
      };
    });
  }

  async create(dto: CreateLediFaoBatchDto) {
    if (!dto.files?.length) {
      throw new BadRequestException('Envie ao menos um arquivo XML.');
    }
    if (dto.files.length > 5000) {
      throw new BadRequestException('Limite de 5000 arquivos por lote.');
    }

    const expectedTipo = this.normalizeExpectedTipo(dto.expectedTipo);
    const label =
      expectedTipo === 'FAI'
        ? 'FAI'
        : expectedTipo === 'PROCEDIMENTOS'
          ? 'Procedimentos'
          : 'FAO';

    const prepared = this.prepareItems(dto.files, expectedTipo);

    const summary = {
      ...this.summarizeBatch(prepared),
      expectedTipo,
    };
    const batch = await this.prisma.lediFaoBatch.create({
      data: {
        name: dto.name?.trim() || `Lote ${label} ${new Date().toISOString().slice(0, 16)}`,
        status:
          summary.readyForFinalSend === summary.total
            ? 'ready'
            : summary.withBlockers === 0
              ? 'partially_fixed'
              : 'analyzed',
        summaryJson: JSON.stringify(summary),
        items: { create: prepared },
      },
      include: { items: { select: { id: true } } },
    });

    void this.prisma.audit('ledi_fao_batch_create', 'ledi_fao_batch', batch.id, [RF.ODONTO.id, RF.ESUS.id], {
      total: summary.total,
      withBlockers: summary.withBlockers,
      readyForFinalSend: summary.readyForFinalSend,
      expectedTipo,
    });

    return this.get(batch.id);
  }

  /** Acrescenta XMLs a um lote existente (upload em pedaços via JSON). */
  async appendFiles(batchId: string, files: Array<{ name: string; xml: string }>) {
    await this.ensureBatch(batchId);
    if (!files?.length) throw new BadRequestException('Envie ao menos um arquivo XML.');
    if (files.length > 500) {
      throw new BadRequestException('Limite de 500 arquivos por pedaço de upload.');
    }
    const expectedTipo = await this.expectedTipoOf(batchId);
    const prepared = this.prepareItems(files, expectedTipo);
    await this.prisma.lediFaoBatchItem.createMany({
      data: prepared.map((p) => ({ ...p, batchId })),
    });
    await this.refreshBatchSummary(batchId);
    return this.get(batchId);
  }

  async list() {
    const rows = await this.prisma.lediFaoBatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { _count: { select: { items: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      createdAt: r.createdAt,
      itemCount: r._count.items,
      summary: JSON.parse(r.summaryJson || '{}'),
    }));
  }

  async get(id: string) {
    const batch = await this.prisma.lediFaoBatch.findUnique({ where: { id } });
    if (!batch) throw new NotFoundException('Lote não encontrado');
    const counts = await this.prisma.lediFaoBatchItem.groupBy({
      by: ['status'],
      where: { batchId: id },
      _count: true,
    });
    return {
      id: batch.id,
      name: batch.name,
      status: batch.status,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
      summary: JSON.parse(batch.summaryJson || '{}'),
      statusCounts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
    };
  }

  async listItems(
    batchId: string,
    opts: {
      status?: string;
      q?: string;
      code?: string;
      tipo?: string;
      offset?: number;
      limit?: number;
    } = {},
  ) {
    await this.ensureBatch(batchId);
    const limit = Math.min(opts.limit ?? 100, 500);
    const offset = opts.offset ?? 0;
    const codeFilter = opts.code?.trim();
    const tipoFilter = opts.tipo?.trim();

    const where = {
      batchId,
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.q ? { fileName: { contains: opts.q } } : {}),
      ...(tipoFilter ? { fichaTipo: tipoFilter } : {}),
    };

    const labelById: Record<string, string> = {
      FAO: 'Atendimento Odontológico (FAO)',
      FAI: 'Atendimento Individual (FAI)',
      PROCEDIMENTOS: 'Ficha de Procedimentos',
      VACINA: 'Vacinação',
      COLETIVO: 'Atividade Coletiva',
      OUTRO: 'Outro',
      UNKNOWN: 'Desconhecido',
    };

    const mapRow = (r: {
      id: string;
      fileName: string;
      status: string;
      findingsJson: string;
      previneJson: string | null;
      autoFixableCodes: string;
      fichaTipo: string | null;
      fichaTipoCode: number | null;
    }): ItemSummary => {
      const findings = JSON.parse(r.findingsJson || '[]') as FaoFinding[];
      let previne: PrevineXray | null = null;
      try {
        previne = r.previneJson ? (JSON.parse(r.previneJson) as PrevineXray) : null;
      } catch {
        previne = null;
      }
      const siapsReady = !findings.some((f) => f.severity === 'BLOCKER');
      const previneReady = !previne || previne.summary.moneyRisks === 0;
      const topCodes = [...new Set(findings.map((f) => f.code))];
      const previneTopCodes = previne
        ? [...new Set(previne.gaps.filter((g) => g.severity !== 'INFO').map((g) => g.code))]
        : [];
      return {
        id: r.id,
        fileName: r.fileName,
        status: r.status,
        blockers: findings.filter((f) => f.severity === 'BLOCKER').length,
        moneyRisks: findings.filter((f) => f.severity === 'MONEY_RISK').length,
        qualityWarns: findings.filter((f) => f.severity === 'QUALITY_WARN').length,
        autoFixableCodes: r.autoFixableCodes ? r.autoFixableCodes.split(',').filter(Boolean) : [],
        topCodes: topCodes.slice(0, 8),
        siapsReady,
        previneReady,
        readyForFinalSend: siapsReady && previneReady,
        previneMoneyRisks: previne?.summary.moneyRisks ?? 0,
        previneTopCodes: previneTopCodes.slice(0, 6),
        fichaTipo: r.fichaTipo,
        fichaTipoCode: r.fichaTipoCode,
        fichaTipoLabel: r.fichaTipo ? labelById[r.fichaTipo] || r.fichaTipo : null,
      };
    };

    const select = {
      id: true,
      fileName: true,
      status: true,
      findingsJson: true,
      previneJson: true,
      autoFixableCodes: true,
      fichaTipo: true,
      fichaTipoCode: true,
    } as const;

    if (codeFilter) {
      const rows = await this.prisma.lediFaoBatchItem.findMany({
        where,
        orderBy: [{ status: 'asc' }, { fileName: 'asc' }],
        select,
      });
      const matched = rows
        .map(mapRow)
        .filter(
          (it) =>
            it.topCodes.includes(codeFilter) ||
            it.previneTopCodes.includes(codeFilter) ||
            it.autoFixableCodes.includes(codeFilter),
        );
      return {
        total: matched.length,
        offset,
        limit,
        items: matched.slice(offset, offset + limit),
        code: codeFilter,
        tipo: tipoFilter || undefined,
      };
    }

    const [total, rows] = await Promise.all([
      this.prisma.lediFaoBatchItem.count({ where }),
      this.prisma.lediFaoBatchItem.findMany({
        where,
        orderBy: [{ status: 'asc' }, { fileName: 'asc' }],
        skip: offset,
        take: limit,
        select,
      }),
    ]);

    return { total, offset, limit, items: rows.map(mapRow), tipo: tipoFilter || undefined };
  }

  async getItem(batchId: string, itemId: string) {
    const item = await this.prisma.lediFaoBatchItem.findFirst({
      where: { id: itemId, batchId },
    });
    if (!item) throw new NotFoundException('Item não encontrado');
    const findings = JSON.parse(item.findingsJson || '[]') as FaoFinding[];
    let master: unknown = null;
    try {
      master = item.masterJson
        ? JSON.parse(item.masterJson)
        : extractFaoMasterFromXml(item.currentXml).master;
    } catch {
      master = null;
    }
    let previneXray: PrevineXray | null = null;
    try {
      previneXray = item.previneJson ? (JSON.parse(item.previneJson) as PrevineXray) : null;
    } catch {
      previneXray = null;
    }
    const siapsReady = !findings.some((f) => f.severity === 'BLOCKER');
    const previneReady = !previneXray || previneXray.summary.moneyRisks === 0;
    const tipo = detectLediFichaTipo(item.currentXml);
    return {
      id: item.id,
      batchId: item.batchId,
      fileName: item.fileName,
      status: item.status,
      findings,
      previneXray,
      siapsReady,
      previneReady,
      readyForFinalSend: siapsReady && previneReady,
      fichaTipo: item.fichaTipo || tipo.id,
      fichaTipoCode: item.fichaTipoCode ?? tipo.code,
      fichaTipoLabel: tipo.label,
      correctionPath: tipo.correctionPath,
      odontoLoteSupported: tipo.odontoLoteSupported,
      autoFixableCodes: item.autoFixableCodes
        ? item.autoFixableCodes.split(',').filter(Boolean)
        : [],
      master,
      currentXml: item.currentXml,
      originalXml: item.originalXml,
      updatedAt: item.updatedAt,
    };
  }

  async autoFix(batchId: string, dto: AutoFixLediFaoBatchDto) {
    await this.ensureBatch(batchId);
    const expectedTipo = await this.expectedTipoOf(batchId);
    const opts: AutoFixOptions = {
      stNaoPossuiCpf: dto.forceSelected
        ? dto.stNaoPossuiCpf === true
        : dto.stNaoPossuiCpf !== false,
      stNaoPossuiCpfWhenAbsent: dto.stNaoPossuiCpfWhenAbsent !== false,
      ine: dto.ine,
    };

    const items = await this.prisma.lediFaoBatchItem.findMany({
      where: {
        batchId,
        ...(dto.onlyItemIds?.length ? { id: { in: dto.onlyItemIds } } : {}),
      },
    });

    let touched = 0;
    for (const item of items) {
      const findings = JSON.parse(item.findingsJson || '[]') as FaoFinding[];
      let xml = item.currentXml;
      let changed = false;

      if (opts.stNaoPossuiCpf) {
        const result = applyAutoFixes(xml, findings, opts);
        if (result.applied.length) {
          xml = result.xml;
          changed = true;
        }
      } else if (dto.ine?.trim() && !dto.forceSelected) {
        const result = applyAutoFixes(xml, findings, { ...opts, stNaoPossuiCpf: false, ine: dto.ine });
        if (result.applied.length) {
          xml = result.xml;
          changed = true;
        }
      }

      const codes = new Set([
        ...findings.map((f) => f.code),
        ...(() => {
          try {
            const x = item.previneJson ? (JSON.parse(item.previneJson) as PrevineXray) : null;
            return x ? x.gaps.map((g) => g.code) : [];
          } catch {
            return [] as string[];
          }
        })(),
      ]);

      const force = !!dto.forceSelected && !!dto.onlyItemIds?.length;

      if (dto.ine?.trim() && (force || codes.has('INE_MISSING') || codes.has('PREVINE_INE_MISSING'))) {
        const r = fixIne(xml, dto.ine);
        if (r.changed) {
          xml = r.xml;
          changed = true;
        }
      }

      const problemas = dto.problemasCondicoes?.length
        ? dto.problemasCondicoes
        : dto.problemasCondicoesDefault;
      if (
        problemas?.length &&
        (force || codes.has('PROBLEMAS_MISSING') || codes.has('PROBLEMA_SEM_CODIGO') || codes.has('PREVINE_PROBLEMAS_MISSING'))
      ) {
        const r = fixProblemasCondicoes(xml, problemas);
        if (r.changed) {
          xml = r.xml;
          changed = true;
        }
      }

      if (dto.tiposConsultaOdonto?.length && (force || codes.has('TIPO_CONSULTA_REQUIRED') || codes.has('TRATAMENTO_CONCLUIDO_RULE'))) {
        const r = fixTiposConsultaOdonto(xml, dto.tiposConsultaOdonto);
        if (r.changed) {
          xml = r.xml;
          changed = true;
        }
      }

      if (dto.tiposEncamOdontoAdd?.length && force) {
        const r = addTiposEncamOdonto(xml, dto.tiposEncamOdontoAdd);
        if (r.changed) {
          xml = r.xml;
          changed = true;
        }
      }

      if (
        dto.tiposVigilanciaSaudeBucal?.length &&
        (force || codes.has('PREVINE_VIGILANCIA_99') || codes.has('VIGILANCIA_MISSING'))
      ) {
        const r = fixTiposVigilanciaSaudeBucal(xml, dto.tiposVigilanciaSaudeBucal);
        if (r.changed) {
          xml = r.xml;
          changed = true;
        }
      }

      if (dto.procedimentosAdd?.length && force) {
        const r = addProcedimentos(xml, dto.procedimentosAdd);
        if (r.changed) {
          xml = r.xml;
          changed = true;
        }
      }

      if (
        dto.cboCodigo_2002?.trim() &&
        (force || codes.has('PREVINE_CBO_NOT_ESB') || codes.has('CBO_NOT_ODONTO') || codes.has('CBO_MISSING'))
      ) {
        const r = fixCbo(xml, dto.cboCodigo_2002);
        if (r.changed) {
          xml = r.xml;
          changed = true;
        }
      }

      if (dto.turno != null && (force || codes.has('TURNO'))) {
        const r = fixTurno(xml, dto.turno);
        if (r.changed) {
          xml = r.xml;
          changed = true;
        }
      }

      if (dto.gestante !== undefined && (force || codes.has('GESTANTE_MISSING'))) {
        const r = fixGestante(xml, dto.gestante);
        if (r.changed) {
          xml = r.xml;
          changed = true;
        }
      }

      if (dto.localAtendimento != null && (force || codes.has('LOCAL_ATENDIMENTO'))) {
        const r = fixLocalAtendimento(xml, dto.localAtendimento);
        if (r.changed) {
          xml = r.xml;
          changed = true;
        }
      }

      if (dto.cnes?.trim() && (force || codes.has('CNES_MISSING') || codes.has('CNES_FORMAT'))) {
        const r = fixCnes(xml, dto.cnes);
        if (r.changed) {
          xml = r.xml;
          changed = true;
        }
      }

      if (
        dto.codigoIbgeMunicipio?.trim() &&
        (force || codes.has('IBGE_MISSING') || codes.has('IBGE_FORMAT'))
      ) {
        const r = fixIbge(xml, dto.codigoIbgeMunicipio);
        if (r.changed) {
          xml = r.xml;
          changed = true;
        }
      }

      if (!changed) continue;
      await this.persistXml(item.id, xml, expectedTipo);
      touched += 1;
    }

    await this.refreshBatchSummary(batchId);
    void this.prisma.audit('ledi_fao_batch_auto_fix', 'ledi_fao_batch', batchId, [RF.ODONTO.id], {
      touched,
      force: dto.forceSelected,
    });
    return { ...(await this.get(batchId)), touched };
  }

  async patchItem(batchId: string, itemId: string, dto: PatchLediFaoBatchItemDto) {
    const expectedTipo = await this.expectedTipoOf(batchId);
    const item = await this.prisma.lediFaoBatchItem.findFirst({
      where: { id: itemId, batchId },
    });
    if (!item) throw new NotFoundException('Item não encontrado');

    let xml = item.currentXml;
    const applied: string[] = [];

    if (dto.ine?.trim()) {
      const r = fixIne(xml, dto.ine);
      xml = r.xml;
      if (r.changed) applied.push('INE');
    }

    if (dto.stNaoPossuiCpf !== undefined) {
      xml = xml.replace(/<stNaoPossuiCpf\b[^>]*>[\s\S]*?<\/stNaoPossuiCpf>\s*/gi, '');
      const r = fixStNaoPossuiCpf(xml, dto.stNaoPossuiCpf);
      xml = r.xml.replace(
        /<stNaoPossuiCpf>\s*(true|false)\s*<\/stNaoPossuiCpf>/gi,
        `<stNaoPossuiCpf>${dto.stNaoPossuiCpf}</stNaoPossuiCpf>`,
      );
      applied.push('ST_NAO_POSSUI_CPF');
    }

    if (dto.problemasCondicoes?.length) {
      const r = fixProblemasCondicoes(xml, dto.problemasCondicoes);
      xml = r.xml;
      if (r.changed) applied.push('PROBLEMAS');
    }

    if (dto.tiposConsultaOdonto?.length) {
      const r = fixTiposConsultaOdonto(xml, dto.tiposConsultaOdonto);
      xml = r.xml;
      if (r.changed) applied.push('TIPOS_CONSULTA');
    }

    if (dto.tiposEncamOdontoAdd?.length) {
      const r = addTiposEncamOdonto(xml, dto.tiposEncamOdontoAdd);
      xml = r.xml;
      if (r.changed) applied.push('TIPOS_ENCAM');
    }

    if (dto.tiposVigilanciaSaudeBucal?.length) {
      const r = fixTiposVigilanciaSaudeBucal(xml, dto.tiposVigilanciaSaudeBucal);
      xml = r.xml;
      if (r.changed) applied.push('VIGILANCIA');
    }

    if (dto.procedimentosAdd?.length) {
      const r = addProcedimentos(xml, dto.procedimentosAdd);
      xml = r.xml;
      if (r.changed) applied.push('PROCEDIMENTOS');
    }

    if (dto.cboCodigo_2002?.trim()) {
      const r = fixCbo(xml, dto.cboCodigo_2002);
      xml = r.xml;
      if (r.changed) applied.push('CBO');
    }

    if (dto.turno != null) {
      const r = fixTurno(xml, dto.turno);
      xml = r.xml;
      if (r.changed) applied.push('TURNO');
    }

    if (dto.gestante !== undefined) {
      const r = fixGestante(xml, dto.gestante);
      xml = r.xml;
      if (r.changed) applied.push('GESTANTE');
    }

    if (dto.localAtendimento != null) {
      const r = fixLocalAtendimento(xml, dto.localAtendimento);
      xml = r.xml;
      if (r.changed) applied.push('LOCAL');
    }

    if (dto.cnes?.trim()) {
      const r = fixCnes(xml, dto.cnes);
      xml = r.xml;
      if (r.changed) applied.push('CNES');
    }

    if (dto.codigoIbgeMunicipio?.trim()) {
      const r = fixIbge(xml, dto.codigoIbgeMunicipio);
      xml = r.xml;
      if (r.changed) applied.push('IBGE');
    }

    if (dto.xml?.trim()) {
      xml = dto.xml.trim();
      applied.push('RAW_XML');
    }

    if (!applied.length) {
      throw new BadRequestException('Nenhuma alteração informada.');
    }

    await this.persistXml(item.id, xml, expectedTipo);
    await this.refreshBatchSummary(batchId);
    return this.getItem(batchId, itemId);
  }

  async exportZip(batchId: string, mode: 'current' | 'conformant' = 'current') {
    await this.ensureBatch(batchId);
    const items = await this.prisma.lediFaoBatchItem.findMany({
      where: {
        batchId,
        ...(mode === 'conformant'
          ? { OR: [{ status: 'conformant' }, { status: 'warn' }] }
          : {}),
      },
      select: { fileName: true, currentXml: true, status: true },
      orderBy: { fileName: 'asc' },
    });
    if (!items.length) throw new BadRequestException('Nenhum arquivo para exportar.');

    const zip = buildStoreZip(
      items.map((it) => ({
        name: it.fileName.endsWith('.xml') ? it.fileName : `${it.fileName}.xml`,
        data: it.currentXml,
      })),
    );

    void this.prisma.audit('ledi_fao_batch_export', 'ledi_fao_batch', batchId, [RF.ODONTO.id], {
      count: items.length,
      mode,
    });

    return new StreamableFile(zip, {
      type: 'application/zip',
      disposition: `attachment; filename="ledi-fao-lote-${batchId.slice(0, 8)}.zip"`,
    });
  }

  async delete(batchId: string) {
    await this.ensureBatch(batchId);
    await this.prisma.lediFaoBatch.delete({ where: { id: batchId } });
    return { ok: true };
  }

  private async ensureBatch(id: string) {
    const b = await this.prisma.lediFaoBatch.findUnique({ where: { id }, select: { id: true } });
    if (!b) throw new NotFoundException('Lote não encontrado');
  }

  private async persistXml(itemId: string, xml: string, expectedTipo: LediLoteTipo) {
    const tipo = detectLediFichaTipo(xml);
    const report = this.reportFromXml(xml, expectedTipo);
    const findings = [...report.findings];
    const label =
      expectedTipo === 'FAI' ? 'FAI' : expectedTipo === 'PROCEDIMENTOS' ? 'Procedimentos' : 'FAO';
    if (!this.tipoMatchOk(tipo.id, expectedTipo)) {
      findings.unshift({
        severity: 'BLOCKER',
        code: 'WRONG_FICHA_TIPO',
        message: `Arquivo é ${tipo.label} (tipo ${tipo.code ?? '?'}) — este lote espera ${label}.`,
        hint: tipo.correctionPath,
        field: 'tipoDadoSerializado',
        rule: 'LEDI-tipo',
      });
    }
    const auto = classifyAutoFixable(findings);
    const status = this.findingsStatus(findings);

    let masterJson: string | null = null;
    if (expectedTipo === 'FAO') {
      try {
        const extracted = extractFaoMasterFromXml(xml);
        if (extracted.master) masterJson = JSON.stringify(extracted.master);
      } catch {
        masterJson = null;
      }
    }

    await this.prisma.lediFaoBatchItem.update({
      where: { id: itemId },
      data: {
        currentXml: xml,
        findingsJson: JSON.stringify(findings),
        previneJson: report.previneXray ? JSON.stringify(report.previneXray) : null,
        fichaTipo: tipo.id,
        fichaTipoCode: tipo.code,
        autoFixableCodes: auto.join(','),
        masterJson,
        status,
      },
    });
  }

  private async refreshBatchSummary(batchId: string) {
    const batch = await this.prisma.lediFaoBatch.findUnique({
      where: { id: batchId },
      select: { summaryJson: true },
    });
    const prev = JSON.parse(batch?.summaryJson || '{}') as { expectedTipo?: string };
    const expectedTipo = this.normalizeExpectedTipo(prev.expectedTipo);
    const items = await this.prisma.lediFaoBatchItem.findMany({
      where: { batchId },
      select: {
        status: true,
        findingsJson: true,
        autoFixableCodes: true,
        previneJson: true,
        fileName: true,
        fichaTipo: true,
      },
    });
    const summary = { ...this.summarizeBatch(items), expectedTipo };
    const status =
      summary.readyForFinalSend === summary.total
        ? 'ready'
        : summary.withBlockers === 0
          ? 'partially_fixed'
          : 'analyzed';
    await this.prisma.lediFaoBatch.update({
      where: { id: batchId },
      data: { summaryJson: JSON.stringify(summary), status },
    });
  }
}
