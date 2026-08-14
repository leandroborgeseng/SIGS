import { createHash } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../infra/storage/storage.service';
import { lediBatchMaxFiles } from './ledi-zip.extract';
import { RF } from '../common/rf';
import { type FaoFinding } from './ledi-fao.validator';
import { extractFaoMasterFromXml } from './ledi-fao-xml.parser';
import {
  aggregatePrevineXrays,
  type PrevineXray,
} from './ledi-fao-previne-xray';
import { detectLediFichaTipo } from './ledi-ficha-tipo';
import { runRulesEngine } from '../clinical-core/rules-engine';
import {
  classifyAutoFixable,
  addProcedimentos,
  addTiposEncamOdonto,
  fixCbo,
  fixCnes,
  fixCnsCidadao,
  fixCpfCidadao,
  fixDataAtendimento,
  fixDataHoraAtendimento,
  fixDtNascimento,
  fixGestante,
  fixIbge,
  fixIne,
  fixJustificativaNaoPossuiCpf,
  fixKeepCitizenId,
  fixLocalAtendimento,
  fixProfissionalCns,
  fixSexo,
  fixTiposEncamOdonto,
  fixTiposVigilanciaSaudeBucal,
  fixProblemasCondicoes,
  fixStNaoPossuiCpf,
  fixTiposConsultaOdonto,
  fixTurno,
  fixRemoveJustificativaNaoPossuiCpf,
  fixForceStNaoPossuiCpfTrue,
  fixUuidFichaLength,
  fixProcFichaProcedimentos,
} from './ledi-fao-xml.fixer';
import {
  FRANCA_LEDI_DEFAULTS,
  previneGapCodes,
  runAutoFixPipeline,
} from './ledi-autofix.pipeline';
import { fixCondutasFai, fixTipoAtendimentoFai } from './ledi-fai-xml.fixer';
import { buildStoreZip } from './zip-store';
import {
  CreateLediFaoBatchDto,
  PatchLediFaoBatchItemDto,
  AutoFixLediFaoBatchDto,
} from './dto';
import {
  buildTreatmentSnapshot,
  mergeTreatmentProgress,
  type TreatmentProgress,
} from './ledi-treatment-metrics';
import {
  buildPendingReport,
  itemIsPending,
  parseSeverityFilter,
  type PendingReportItemInput,
} from './ledi-pending-report';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Limite para manter XML inline no Postgres (acima disso só object key). */
  private inlineMaxBytes() {
    return Number(process.env.LEDI_XML_INLINE_MAX || 200_000);
  }

  private inlineOrEmpty(xml: string) {
    return Buffer.byteLength(xml, 'utf8') <= this.inlineMaxBytes() ? xml : '';
  }

  async resolveCurrentXml(item: {
    id: string;
    currentXml?: string | null;
    currentObjectKey?: string | null;
  }): Promise<string> {
    if (item.currentXml) return item.currentXml;
    if (item.currentObjectKey) return this.storage.getText(item.currentObjectKey);
    throw new BadRequestException(`XML ausente no item ${item.id}`);
  }

  private normalizeExpectedTipo(raw?: string): LediLoteTipo {
    const t = (raw || 'FAO').toUpperCase();
    if (t === 'FAI') return 'FAI';
    if (t === 'PROCEDIMENTOS' || t === 'PROC') return 'PROCEDIMENTOS';
    return 'FAO';
  }

  private reportFromXml(xml: string, expectedTipo: LediLoteTipo = 'FAO'): UnifiedReport {
    const engine = runRulesEngine({ xml, rulePack: expectedTipo, includePrevine: true });
    return {
      findings: engine.findings as FaoFinding[],
      siapsReady: engine.siapsReady,
      previneReady: engine.previneReady,
      readyForFinalSend: engine.readyForFinalSend,
      previneXray: engine.previneXray,
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
      currentXml?: string | null;
      originalXml?: string | null;
    }>,
    prevTreatment?: Partial<TreatmentProgress>,
    touchedDelta = 0,
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
      } else if (!hasBlocker) {
        readyForFinalSend += 1;
        previneReady += 1;
      }
    }

    const topCodes = [...codeFiles.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([code, files]) => ({ code, files, pct: Math.round((files / items.length) * 1000) / 10 }));

    const previne = xrayItems.length ? aggregatePrevineXrays(xrayItems) : null;
    const treatmentCurrent = buildTreatmentSnapshot(items);
    const treatment = mergeTreatmentProgress(prevTreatment, treatmentCurrent, {
      touchedDelta,
    });

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
      treatment,
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

  private async prepareItems(
    files: Array<{ name: string; xml: string }>,
    expectedTipo: LediLoteTipo,
    batchIdForKeys?: string,
  ) {
    const label =
      expectedTipo === 'FAI'
        ? 'FAI'
        : expectedTipo === 'PROCEDIMENTOS'
          ? 'Procedimentos'
          : 'FAO';

    const scope = batchIdForKeys || 'pending';
    const out = [];
    for (const f of files) {
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
      const auto = classifyAutoFixable(findings, expectedTipo === 'PROCEDIMENTOS' ? undefined : expectedTipo);
      let masterJson: string | null = null;
      if (expectedTipo === 'FAO') {
        try {
          const extracted = extractFaoMasterFromXml(xml);
          if (extracted.master) masterJson = JSON.stringify(extracted.master);
        } catch {
          masterJson = null;
        }
      }
      const xmlBytes = Buffer.byteLength(xml, 'utf8');
      const sha256 = createHash('sha256').update(xml, 'utf8').digest('hex');
      // Fichas LEDI típicas cabem inline; evitar milhares de putXml no request.
      let objectKey: string | null = null;
      if (xmlBytes > this.inlineMaxBytes()) {
        const stored = await this.storage.putXml(scope, f.name.slice(0, 80), xml);
        objectKey = stored.key;
      }
      const inline = this.inlineOrEmpty(xml);
      out.push({
        fileName: f.name.slice(0, 255),
        status: this.findingsStatus(findings),
        originalXml: inline,
        currentXml: inline,
        originalObjectKey: objectKey,
        currentObjectKey: objectKey,
        xmlSha256: sha256,
        findingsJson: JSON.stringify(findings),
        previneJson: report.previneXray ? JSON.stringify(report.previneXray) : null,
        fichaTipo: tipo.id,
        fichaTipoCode: tipo.code,
        masterJson,
        autoFixableCodes: auto.join(','),
      });
    }
    return out;
  }

  /** Postgres limita ~32767 binds por statement; lotes e-SUS passam de 5k fichas. */
  private async createManyItems(
    data: Array<{
      batchId: string;
      fileName: string;
      status: string;
      originalXml: string;
      currentXml: string;
      originalObjectKey: string | null;
      currentObjectKey: string | null;
      xmlSha256: string;
      findingsJson: string;
      previneJson: string | null;
      fichaTipo: string;
      fichaTipoCode: number | null;
      masterJson: string | null;
      autoFixableCodes: string;
    }>,
  ) {
    const chunk = 80;
    for (let i = 0; i < data.length; i += chunk) {
      await this.prisma.lediFaoBatchItem.createMany({ data: data.slice(i, i + chunk) });
    }
  }

  async create(dto: CreateLediFaoBatchDto) {
    if (!dto.files?.length) {
      throw new BadRequestException('Envie ao menos um arquivo XML.');
    }
    const maxFiles = lediBatchMaxFiles();
    if (dto.files.length > maxFiles) {
      throw new BadRequestException(
        `Limite de ${maxFiles} arquivos por lote (recebidos: ${dto.files.length}). Divida o ZIP (por unidade/período) ou envie em partes.`,
      );
    }

    const expectedTipo = this.normalizeExpectedTipo(dto.expectedTipo);
    const label =
      expectedTipo === 'FAI'
        ? 'FAI'
        : expectedTipo === 'PROCEDIMENTOS'
          ? 'Procedimentos'
          : 'FAO';

    // Cria lote vazio primeiro para namespacing de object keys
    const batchStub = await this.prisma.lediFaoBatch.create({
      data: {
        name: dto.name?.trim() || `Lote ${label} ${new Date().toISOString().slice(0, 16)}`,
        status: 'uploaded',
        summaryJson: '{}',
      },
    });

    try {
      const prepared = await this.prepareItems(dto.files, expectedTipo, batchStub.id);
      const summary = {
        ...this.summarizeBatch(prepared),
        expectedTipo,
      };
      await this.createManyItems(prepared.map((p) => ({ ...p, batchId: batchStub.id })));
      await this.prisma.lediFaoBatch.update({
        where: { id: batchStub.id },
        data: {
          status:
            summary.readyForFinalSend === summary.total
              ? 'ready'
              : summary.withBlockers === 0
                ? 'partially_fixed'
                : 'analyzed',
          summaryJson: JSON.stringify(summary),
        },
      });

      void this.prisma.audit(
        'ledi_fao_batch_create',
        'ledi_fao_batch',
        batchStub.id,
        [RF.ODONTO.id, RF.ESUS.id],
        {
          total: summary.total,
          withBlockers: summary.withBlockers,
          readyForFinalSend: summary.readyForFinalSend,
          expectedTipo,
          storage: this.storage.getDriver(),
        },
      );

      return this.get(batchStub.id);
    } catch (err) {
      await this.prisma.lediFaoBatch.delete({ where: { id: batchStub.id } }).catch(() => undefined);
      throw err;
    }
  }

  /** Acrescenta XMLs a um lote existente (upload em pedaços via JSON/multipart). */
  async appendFiles(
    batchId: string,
    files: Array<{ name: string; xml: string }>,
    opts?: { refreshSummary?: boolean },
  ) {
    await this.ensureBatch(batchId);
    if (!files?.length) throw new BadRequestException('Envie ao menos um arquivo XML.');
    if (files.length > 500) {
      throw new BadRequestException('Limite de 500 arquivos por pedaço de upload.');
    }
    const maxFiles = lediBatchMaxFiles();
    const existing = await this.prisma.lediFaoBatchItem.count({ where: { batchId } });
    if (existing + files.length > maxFiles) {
      throw new BadRequestException(
        `Limite de ${maxFiles} arquivos por lote (já ${existing}, +${files.length}). Divida o ZIP.`,
      );
    }
    const expectedTipo = await this.expectedTipoOf(batchId);
    const prepared = await this.prepareItems(files, expectedTipo, batchId);
    await this.createManyItems(prepared.map((p) => ({ ...p, batchId })));
    if (opts?.refreshSummary === false) {
      await this.bumpBatchTotal(batchId, prepared.length);
    } else {
      await this.refreshBatchSummary(batchId);
    }
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
    type BatchSummaryView = {
      total?: number;
      conformant?: number;
      withBlockers?: number;
      withWarn?: number;
      autoFixableItems?: number;
      siapsReady?: number;
      readyForFinalSend?: number;
      topCodes?: Array<{ code: string; files: number; pct: number }>;
      treatment?: TreatmentProgress;
      expectedTipo?: string;
    };
    let summary = JSON.parse(batch.summaryJson || '{}') as BatchSummaryView;
    const itemCount = await this.prisma.lediFaoBatchItem.count({ where: { batchId: id } });
    if (!summary.treatment || (summary.total != null && summary.total !== itemCount)) {
      await this.refreshBatchSummary(id);
      const again = await this.prisma.lediFaoBatch.findUnique({ where: { id } });
      summary = JSON.parse(again?.summaryJson || '{}') as BatchSummaryView;
    }
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
      summary,
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
      bucket?: string;
      offset?: number;
      limit?: number;
    } = {},
  ) {
    await this.ensureBatch(batchId);
    const limit = Math.min(opts.limit ?? 100, 500);
    const offset = opts.offset ?? 0;
    const codeFilter = opts.code?.trim();
    const tipoFilter = opts.tipo?.trim();
    const bucket = opts.bucket?.trim();

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

    if (codeFilter || bucket) {
      const rows = await this.prisma.lediFaoBatchItem.findMany({
        where,
        orderBy: [{ status: 'asc' }, { fileName: 'asc' }],
        select,
      });
      let matched = rows.map(mapRow);
      if (codeFilter) {
        matched = matched.filter(
          (it) =>
            it.topCodes.includes(codeFilter) ||
            it.previneTopCodes.includes(codeFilter) ||
            it.autoFixableCodes.includes(codeFilter),
        );
      }
      if (bucket === 'bloqueio') {
        matched = matched.filter((it) => !it.siapsReady);
      } else if (bucket === 'risco') {
        matched = matched.filter(
          (it) => it.siapsReady && (it.moneyRisks > 0 || (it.previneMoneyRisks ?? 0) > 0),
        );
      } else if (bucket === 'indicadores') {
        matched = matched.filter(
          (it) =>
            it.siapsReady &&
            it.moneyRisks === 0 &&
            (it.previneMoneyRisks ?? 0) === 0 &&
            it.qualityWarns > 0,
        );
      } else if (bucket === 'ideal') {
        matched = matched.filter((it) => it.readyForFinalSend);
      }
      return {
        total: matched.length,
        offset,
        limit,
        items: matched.slice(offset, offset + limit),
        code: codeFilter || undefined,
        tipo: tipoFilter || undefined,
        bucket: bucket || undefined,
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
    const currentXml = await this.resolveCurrentXml(item);
    const originalXml = item.originalXml
      ? item.originalXml
      : item.originalObjectKey
        ? await this.storage.getText(item.originalObjectKey)
        : '';
    const findings = JSON.parse(item.findingsJson || '[]') as FaoFinding[];
    let master: unknown = null;
    try {
      master = item.masterJson
        ? JSON.parse(item.masterJson)
        : extractFaoMasterFromXml(currentXml).master;
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
    const tipo = detectLediFichaTipo(currentXml);
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
      currentXml,
      originalXml,
      version: item.version,
      xmlSha256: item.xmlSha256,
      updatedAt: item.updatedAt,
    };
  }

  async autoFix(batchId: string, dto: AutoFixLediFaoBatchDto) {
    await this.ensureBatch(batchId);
    const expectedTipo = await this.expectedTipoOf(batchId);

    const items = await this.prisma.lediFaoBatchItem.findMany({
      where: {
        batchId,
        ...(dto.onlyItemIds?.length ? { id: { in: dto.onlyItemIds } } : {}),
      },
    });

    let touched = 0;
    for (const item of items) {
      const findings = JSON.parse(item.findingsJson || '[]') as FaoFinding[];
      const xml = await this.resolveCurrentXml(item);
      const result = runAutoFixPipeline(
        xml,
        findings,
        { ...dto, fichaTipo: expectedTipo === 'PROCEDIMENTOS' ? undefined : expectedTipo },
        previneGapCodes(item.previneJson),
      );
      if (!result.changed) continue;
      await this.persistXml(item.id, result.xml, expectedTipo);
      touched += 1;
    }

    await this.refreshBatchSummary(batchId, touched);
    void this.prisma.audit('ledi_fao_batch_auto_fix', 'ledi_fao_batch', batchId, [RF.ODONTO.id], {
      touched,
      force: dto.forceSelected,
    });
    return { ...(await this.get(batchId)), touched };
  }

  /**
   * Simula auto-fix sem gravar — retorna impacto (alertas que somem / surgem).
   */
  async dryRun(batchId: string, dto: AutoFixLediFaoBatchDto) {
    await this.ensureBatch(batchId);
    const expectedTipo = await this.expectedTipoOf(batchId);
    const items = await this.prisma.lediFaoBatchItem.findMany({
      where: {
        batchId,
        ...(dto.onlyItemIds?.length ? { id: { in: dto.onlyItemIds } } : {}),
      },
    });

    const beforeCodes = new Map<string, number>();
    const afterCodes = new Map<string, number>();
    let wouldTouch = 0;
    let beforeBlockers = 0;
    let afterBlockers = 0;
    let beforeSiaps = 0;
    let afterSiaps = 0;
    const samples: Array<{
      id: string;
      fileName: string;
      applied: string[];
      codesRemoved: string[];
      codesAdded: string[];
    }> = [];

    const bump = (map: Map<string, number>, code: string) => {
      map.set(code, (map.get(code) || 0) + 1);
    };

    for (const item of items) {
      const findings = JSON.parse(item.findingsJson || '[]') as FaoFinding[];
      const beforeSet = new Set(findings.map((f) => f.code));
      for (const c of beforeSet) bump(beforeCodes, c);
      if (findings.some((f) => f.severity === 'BLOCKER')) beforeBlockers += 1;
      else beforeSiaps += 1;

      const result = runAutoFixPipeline(
        await this.resolveCurrentXml(item),
        findings,
        { ...dto, fichaTipo: expectedTipo === 'PROCEDIMENTOS' ? undefined : expectedTipo },
        previneGapCodes(item.previneJson),
      );
      if (!result.changed) {
        for (const c of beforeSet) bump(afterCodes, c);
        if (findings.some((f) => f.severity === 'BLOCKER')) afterBlockers += 1;
        else afterSiaps += 1;
        continue;
      }

      wouldTouch += 1;
      const afterReport = this.reportFromXml(result.xml, expectedTipo);
      const afterSet = new Set(afterReport.findings.map((f) => f.code));
      for (const c of afterSet) bump(afterCodes, c);
      if (afterReport.findings.some((f) => f.severity === 'BLOCKER')) afterBlockers += 1;
      else afterSiaps += 1;

      if (samples.length < 8) {
        samples.push({
          id: item.id,
          fileName: item.fileName,
          applied: result.applied,
          codesRemoved: [...beforeSet].filter((c) => !afterSet.has(c)),
          codesAdded: [...afterSet].filter((c) => !beforeSet.has(c)),
        });
      }
    }

    const allCodes = new Set([...beforeCodes.keys(), ...afterCodes.keys()]);
    const delta = [...allCodes]
      .map((code) => ({
        code,
        before: beforeCodes.get(code) || 0,
        after: afterCodes.get(code) || 0,
        delta: (afterCodes.get(code) || 0) - (beforeCodes.get(code) || 0),
      }))
      .filter((r) => r.delta !== 0)
      .sort((a, b) => a.delta - b.delta || a.code.localeCompare(b.code));

    return {
      batchId,
      dryRun: true as const,
      wouldTouch,
      totalConsidered: items.length,
      before: { withBlockers: beforeBlockers, siapsReady: beforeSiaps },
      after: { withBlockers: afterBlockers, siapsReady: afterSiaps },
      codeDelta: delta,
      samples,
      defaults: FRANCA_LEDI_DEFAULTS,
    };
  }

  /** Relatório de fechamento do lote (JSON + Markdown). */
  async closureReport(batchId: string) {
    const batch = await this.get(batchId);
    const s = batch.summary;
    const lines: string[] = [
      `# Relatório de fechamento LEDI`,
      ``,
      `- **Lote:** ${batch.name}`,
      `- **Id:** \`${batch.id}\``,
      `- **Tipo esperado:** ${s.expectedTipo || 'FAO'}`,
      `- **Status:** ${batch.status}`,
      `- **Gerado em:** ${new Date().toISOString()}`,
      ``,
      `## Contagens`,
      ``,
      `| Métrica | Valor |`,
      `|---|---:|`,
      `| Total de fichas | ${s.total} |`,
      `| Com blocker | ${s.withBlockers} |`,
      `| Conformes | ${s.conformant} |`,
      `| Siaps-ready | ${s.siapsReady ?? '—'} |`,
      `| Prontas p/ envio | ${s.readyForFinalSend ?? '—'} |`,
      `| Auto-corrigíveis | ${s.autoFixableItems} |`,
      ``,
      `## Top códigos restantes`,
      ``,
    ];

    if (!s.topCodes?.length) {
      lines.push('_Nenhum alerta restante._', '');
    } else {
      lines.push(`| Código | Fichas | % |`, `|---|---:|---:|`);
      for (const c of s.topCodes) {
        lines.push(`| \`${c.code}\` | ${c.files} | ${c.pct}% |`);
      }
      lines.push('');
    }

    lines.push(
      `## Gate`,
      ``,
      `- **Siaps-ready** = sem BLOCKER (envio possível).`,
      `- **Previne-ideal** ≠ Siaps-ready — indicadores B1–B6 são orientação de produção.`,
      `- ZIP recomendado quando \`readyForFinalSend\` = total ou override auditado.`,
      ``,
      `## Defaults Franca`,
      ``,
      `- IBGE: \`${FRANCA_LEDI_DEFAULTS.municipioIbge}\``,
      `- CBO odonto sugestão: \`${FRANCA_LEDI_DEFAULTS.cboOdontoPadrao}\``,
      ``,
    );

    const markdown = lines.join('\n');
    void this.prisma.audit('ledi_fao_batch_closure_report', 'ledi_fao_batch', batchId, [RF.ODONTO.id], {
      withBlockers: s.withBlockers,
      readyForFinalSend: s.readyForFinalSend,
    });

    return {
      batchId: batch.id,
      name: batch.name,
      summary: s,
      markdown,
      defaults: FRANCA_LEDI_DEFAULTS,
    };
  }

  /**
   * Fichas ainda não ideais após tratamento: BLOCKER / MONEY_RISK / QUALITY_WARN.
   * JSON + CSV + Markdown. Sem XML clínico; CPF/CNS mascarados.
   */
  async pendingReport(batchId: string, opts: { severity?: string } = {}) {
    let severityFilter;
    try {
      severityFilter = parseSeverityFilter(opts.severity);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    const batch = await this.get(batchId);
    const rows = await this.prisma.lediFaoBatchItem.findMany({
      where: { batchId },
      select: {
        id: true,
        fileName: true,
        findingsJson: true,
        previneJson: true,
        currentXml: true,
        currentObjectKey: true,
        fichaTipo: true,
      },
      orderBy: { fileName: 'asc' },
    });

    const items: PendingReportItemInput[] = [];
    for (const row of rows) {
      const findings = JSON.parse(row.findingsJson || '[]') as FaoFinding[];
      let previne: PrevineXray | null = null;
      try {
        previne = row.previneJson ? (JSON.parse(row.previneJson) as PrevineXray) : null;
      } catch {
        previne = null;
      }
      if (!itemIsPending(findings, previne, severityFilter)) continue;

      let xml = '';
      try {
        xml = await this.resolveCurrentXml(row);
      } catch {
        xml = '';
      }
      items.push({
        itemId: row.id,
        fileName: row.fileName,
        xml,
        findings,
        previne,
        fichaTipo: row.fichaTipo,
      });
    }

    const expectedTipo =
      (batch.summary as { expectedTipo?: string }).expectedTipo || 'FAO';
    const report = buildPendingReport({
      batchId: batch.id,
      name: batch.name,
      expectedTipo,
      totalFichas: batch.summary.total ?? rows.length,
      items,
      severityFilter,
    });

    void this.prisma.audit('ledi_fao_batch_pending_report', 'ledi_fao_batch', batchId, [RF.ODONTO.id], {
      pendingCount: report.pendingCount,
      severity: opts.severity || null,
    });

    return report;
  }

  async patchItem(batchId: string, itemId: string, dto: PatchLediFaoBatchItemDto) {
    const expectedTipo = await this.expectedTipoOf(batchId);
    const item = await this.prisma.lediFaoBatchItem.findFirst({
      where: { id: itemId, batchId },
    });
    if (!item) throw new NotFoundException('Item não encontrado');

    if (dto.expectedVersion != null && dto.expectedVersion !== item.version) {
      throw new ConflictException(
        `Conflito de versão (esperado ${dto.expectedVersion}, atual ${item.version}). Recarregue a ficha.`,
      );
    }

    let xml = await this.resolveCurrentXml(item);
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

    if (dto.justificativaNaoPossuiCpf != null) {
      const r = fixJustificativaNaoPossuiCpf(xml, dto.justificativaNaoPossuiCpf);
      xml = r.xml;
      if (r.changed) applied.push('JUSTIFICATIVA_CPF');
    }

    if (dto.justificativaCpfUnexpected === 'remove') {
      const r = fixRemoveJustificativaNaoPossuiCpf(xml);
      xml = r.xml;
      if (r.changed) applied.push('JUSTIFICATIVA_CPF_UNEXPECTED');
    } else if (dto.justificativaCpfUnexpected === 'force_st') {
      const r = fixForceStNaoPossuiCpfTrue(xml);
      xml = r.xml;
      if (r.changed) applied.push('JUSTIFICATIVA_CPF_UNEXPECTED');
    }

    if (dto.regenerateUuidFicha) {
      const r = fixUuidFichaLength(xml);
      xml = r.xml;
      if (r.changed) applied.push('UUID_FICHA_LENGTH');
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

    if (dto.keepCitizenId === 'cpf' || dto.keepCitizenId === 'cns') {
      const r = fixKeepCitizenId(xml, dto.keepCitizenId);
      xml = r.xml;
      if (r.changed) applied.push('KEEP_CITIZEN_ID');
    }

    if (dto.cpfCidadao?.trim()) {
      const r = fixCpfCidadao(xml, dto.cpfCidadao);
      xml = r.xml;
      if (r.changed) applied.push('CPF');
    }

    if (dto.cnsCidadao?.trim()) {
      const r = fixCnsCidadao(xml, dto.cnsCidadao);
      xml = r.xml;
      if (r.changed) applied.push('CNS');
    }

    if (dto.dtNascimento?.trim()) {
      const r = fixDtNascimento(xml, dto.dtNascimento);
      xml = r.xml;
      if (r.changed) applied.push('DT_NASCIMENTO');
    }

    if (dto.sexo === '0' || dto.sexo === '1') {
      const r = fixSexo(xml, dto.sexo);
      xml = r.xml;
      if (r.changed) applied.push('SEXO');
    }

    if (dto.profissionalCNS?.trim()) {
      const r = fixProfissionalCns(xml, dto.profissionalCNS);
      xml = r.xml;
      if (r.changed) applied.push('PROF_CNS');
    }

    if (dto.dataAtendimento?.trim()) {
      const r = fixDataAtendimento(xml, dto.dataAtendimento);
      xml = r.xml;
      if (r.changed) applied.push('DATA_ATENDIMENTO');
    }

    if (dto.dataHoraInicialAtendimento?.trim()) {
      const r = fixDataHoraAtendimento(xml, 'inicial', dto.dataHoraInicialAtendimento);
      xml = r.xml;
      if (r.changed) applied.push('HORA_INI');
    }

    if (dto.dataHoraFinalAtendimento?.trim()) {
      const r = fixDataHoraAtendimento(xml, 'final', dto.dataHoraFinalAtendimento);
      xml = r.xml;
      if (r.changed) applied.push('HORA_FIM');
    }

    if (dto.tiposEncamOdonto?.length) {
      const r = fixTiposEncamOdonto(xml, dto.tiposEncamOdonto);
      xml = r.xml;
      if (r.changed) applied.push('CONDUTAS');
    }

    if (dto.condutas?.length) {
      const r = fixCondutasFai(xml, dto.condutas);
      xml = r.xml;
      if (r.changed) applied.push('CONDUTAS_FAI');
    }

    if (dto.tipoAtendimento != null) {
      const r = fixTipoAtendimentoFai(xml, dto.tipoAtendimento);
      xml = r.xml;
      if (r.changed) applied.push('TIPO_ATENDIMENTO');
    }

    if (dto.procedimentosCodes?.length) {
      const r = fixProcFichaProcedimentos(xml, dto.procedimentosCodes);
      xml = r.xml;
      if (r.changed) applied.push('PROC_CODES');
    }

    if (dto.xml?.trim()) {
      xml = dto.xml.trim();
      applied.push('RAW_XML');
    }

    if (!applied.length) {
      throw new BadRequestException('Nenhuma alteração informada.');
    }

    await this.persistXml(item.id, xml, expectedTipo, dto.expectedVersion);
    await this.refreshBatchSummary(batchId, 1);
    return this.getItem(batchId, itemId);
  }

  async exportZip(batchId: string, mode: 'current' | 'conformant' = 'current') {
    const zip = await this.exportZipBuffer(batchId, mode);
    return new StreamableFile(zip, {
      type: 'application/zip',
      disposition: `attachment; filename="ledi-fao-lote-${batchId.slice(0, 8)}.zip"`,
    });
  }

  async exportZipBuffer(batchId: string, mode: 'current' | 'conformant' = 'current') {
    await this.ensureBatch(batchId);
    const items = await this.prisma.lediFaoBatchItem.findMany({
      where: {
        batchId,
        ...(mode === 'conformant'
          ? { OR: [{ status: 'conformant' }, { status: 'warn' }] }
          : {}),
      },
      select: {
        id: true,
        fileName: true,
        currentXml: true,
        currentObjectKey: true,
        status: true,
      },
      orderBy: { fileName: 'asc' },
    });
    if (!items.length) throw new BadRequestException('Nenhum arquivo para exportar.');

    const files: Array<{ name: string; data: string }> = [];
    for (const it of items) {
      const data = await this.resolveCurrentXml(it);
      files.push({
        name: it.fileName.endsWith('.xml') ? it.fileName : `${it.fileName}.xml`,
        data,
      });
    }

    const zip = buildStoreZip(files);

    void this.prisma.audit('ledi_fao_batch_export', 'ledi_fao_batch', batchId, [RF.ODONTO.id], {
      count: items.length,
      mode,
    });

    return zip;
  }

  async delete(batchId: string) {
    await this.ensureBatch(batchId);
    await this.prisma.lediFaoBatch.delete({ where: { id: batchId } });
    void this.prisma.audit('ledi_fao_batch_delete', 'ledi_fao_batch', batchId, [RF.ODONTO.id], {});
    return { ok: true };
  }

  /** Remove todos os lotes LEDI (análises de teste / lixo acumulado). */
  async deleteAll() {
    const result = await this.prisma.lediFaoBatch.deleteMany({});
    void this.prisma.audit('ledi_fao_batch_delete_all', 'ledi_fao_batch', 'all', [RF.ODONTO.id], {
      deleted: result.count,
    });
    return { ok: true, deleted: result.count };
  }

  private async ensureBatch(id: string) {
    const b = await this.prisma.lediFaoBatch.findUnique({ where: { id }, select: { id: true } });
    if (!b) throw new NotFoundException('Lote não encontrado');
  }

  async countItems(batchId: string, onlyItemIds?: string[]) {
    await this.ensureBatch(batchId);
    return this.prisma.lediFaoBatchItem.count({
      where: {
        batchId,
        ...(onlyItemIds?.length ? { id: { in: onlyItemIds } } : {}),
      },
    });
  }

  private async persistXml(
    itemId: string,
    xml: string,
    expectedTipo: LediLoteTipo,
    expectedVersion?: number,
  ) {
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
    const auto = classifyAutoFixable(
      findings,
      expectedTipo === 'PROCEDIMENTOS' ? undefined : expectedTipo,
    );
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

    const stored = await this.storage.putXml('items', itemId, xml);
    const inline = this.inlineOrEmpty(xml);
    const data = {
      currentXml: inline,
      currentObjectKey: stored.key,
      xmlSha256: stored.sha256,
      findingsJson: JSON.stringify(findings),
      previneJson: report.previneXray ? JSON.stringify(report.previneXray) : null,
      fichaTipo: tipo.id,
      fichaTipoCode: tipo.code,
      autoFixableCodes: auto.join(','),
      masterJson,
      status,
      version: { increment: 1 },
    };

    if (expectedVersion != null) {
      const updated = await this.prisma.lediFaoBatchItem.updateMany({
        where: { id: itemId, version: expectedVersion },
        data,
      });
      if (updated.count === 0) {
        throw new ConflictException(
          `Conflito de versão ao gravar (esperado ${expectedVersion}). Recarregue a ficha.`,
        );
      }
      return;
    }

    await this.prisma.lediFaoBatchItem.update({
      where: { id: itemId },
      data,
    });
  }

  private async refreshBatchSummary(batchId: string, touchedDelta = 0) {
    const batch = await this.prisma.lediFaoBatch.findUnique({
      where: { id: batchId },
      select: { summaryJson: true },
    });
    const prev = JSON.parse(batch?.summaryJson || '{}') as {
      expectedTipo?: string;
      treatment?: TreatmentProgress;
    };
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
    const summary = {
      ...this.summarizeBatch(items, prev.treatment, touchedDelta),
      expectedTipo,
    };
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

  /** Fatias intermediárias: só incrementa total, sem reler o lote inteiro. */
  private async bumpBatchTotal(batchId: string, delta: number) {
    const batch = await this.prisma.lediFaoBatch.findUnique({
      where: { id: batchId },
      select: { summaryJson: true },
    });
    const prev = JSON.parse(batch?.summaryJson || '{}') as { total?: number };
    const total = (typeof prev.total === 'number' ? prev.total : 0) + delta;
    await this.prisma.lediFaoBatch.update({
      where: { id: batchId },
      data: { summaryJson: JSON.stringify({ ...prev, total }) },
    });
  }
}
