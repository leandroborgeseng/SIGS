import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RF } from '../common/rf';
import {
  AGE_RANGES_SEED,
  AGE_SEED_META,
  ATTENDANCE_GROUPS,
  CATALOG_VERSION,
  COLD_EQUIPMENT_KINDS,
  COLD_EQUIPMENT_STATUSES,
  DOSES,
  IMMUNOBIOLOGICALS_SEED,
  IMMUNO_SEED_META,
  ROUTES,
  SITES,
  STOCK_MVP,
  STRATEGIES,
  THERMAL_BOX_STATUSES,
  VaccineApplicationInput,
  getAgeRanges,
  getImmunobiologicals,
  replaceOverlays,
  validateAgeForApplications,
  validateVaccineApplications,
  type CatalogSyncInput,
} from './catalog';
import {
  CreateColdEquipmentDto,
  CreateSupplyDto,
  CreateSupplyLinkDto,
  CreateTempReadingDto,
  CreateThermalBoxDto,
  CreateVaccinationDto,
  CreateVaccinationStockDto,
  PatchColdEquipmentDto,
  PatchThermalBoxDto,
  SupplyEntryDto,
  VoidVaccinationDto,
} from './dto';
import { buildVaccinationLediPayload } from './ledi-vaccination.mapper';
import { resolveLotacaoHeader } from '../ledi/lotacao.resolver';
import { ClinicalCoreService } from '../clinical-core/clinical-core.service';
import { buildVaccinationCardPdf } from './vaccination-card-pdf';

@Injectable()
export class VaccinationsService implements OnModuleInit {
  private readonly log = new Logger(VaccinationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clinicalCore: ClinicalCoreService,
  ) {}

  async onModuleInit() {
    if (process.env.SKIP_VACCINATION_CATALOG_SEED === '1') return;
    await this.ensureSeeded();
    await this.hydrateOverlaysFromDb();
  }

  /**
   * Persiste seed LEDI + faixas no Prisma (idempotente).
   * Overlays municipais (source=overlay) não são sobrescritos.
   */
  async ensureSeeded(opts?: { force?: boolean }) {
    let immunoCreated = 0;
    let immunoUpdated = 0;
    let immunoSkipped = 0;

    for (const item of IMMUNOBIOLOGICALS_SEED) {
      const existing = await this.prisma.vaccinationImmunobiological.findUnique({
        where: { id: item.id },
      });
      if (!existing) {
        await this.prisma.vaccinationImmunobiological.create({
          data: {
            id: item.id,
            lediId: item.lediId,
            code: item.code || item.id,
            label: item.label,
            active: true,
            source: 'seed',
          },
        });
        immunoCreated += 1;
        continue;
      }
      if (existing.source !== 'seed') {
        immunoSkipped += 1;
        continue;
      }
      if (
        opts?.force ||
        existing.lediId !== item.lediId ||
        existing.label !== item.label ||
        existing.code !== (item.code || item.id)
      ) {
        await this.prisma.vaccinationImmunobiological.update({
          where: { id: item.id },
          data: {
            lediId: item.lediId,
            code: item.code || item.id,
            label: item.label,
            active: true,
            source: 'seed',
          },
        });
        immunoUpdated += 1;
      } else {
        immunoSkipped += 1;
      }
    }

    const seedAgeCount = await this.prisma.vaccinationAgeRange.count({
      where: { source: 'seed' },
    });
    let ageCreated = 0;
    if (seedAgeCount < AGE_RANGES_SEED.length || opts?.force) {
      await this.prisma.vaccinationAgeRange.deleteMany({ where: { source: 'seed' } });
      for (const r of AGE_RANGES_SEED) {
        await this.prisma.vaccinationAgeRange.create({
          data: {
            immunobiologicalId: r.immunobiologicalId,
            strategyId: r.strategyId ?? null,
            minDays: r.minDays,
            maxDays: r.maxDays,
            label: r.label,
            source: 'seed',
          },
        });
        ageCreated += 1;
      }
    }

    const immunoCount = await this.prisma.vaccinationImmunobiological.count();
    const ageCount = await this.prisma.vaccinationAgeRange.count();
    if (immunoCreated || immunoUpdated || ageCreated) {
      this.log.log(
        `Vacinação catalog seed: imuno +${immunoCreated}/~${immunoUpdated} (skip ${immunoSkipped}), ` +
          `faixas +${ageCreated} (total imuno=${immunoCount} faixas=${ageCount})`,
      );
    }
    return {
      immunobiologicals: {
        created: immunoCreated,
        updated: immunoUpdated,
        skipped: immunoSkipped,
        count: immunoCount,
        seedSize: IMMUNOBIOLOGICALS_SEED.length,
      },
      ageRanges: {
        created: ageCreated,
        count: ageCount,
        seedSize: AGE_RANGES_SEED.length,
      },
      catalogVersion: CATALOG_VERSION,
    };
  }

  async hydrateOverlaysFromDb() {
    const [immunos, ages] = await Promise.all([
      this.prisma.vaccinationImmunobiological.findMany({
        where: { source: 'overlay', active: true },
        orderBy: { lediId: 'asc' },
      }),
      this.prisma.vaccinationAgeRange.findMany({
        where: { source: 'overlay' },
        orderBy: { immunobiologicalId: 'asc' },
      }),
    ]);
    replaceOverlays({
      immunobiologicals: immunos.map((r) => ({
        id: r.id,
        label: r.label,
        code: r.code,
        lediId: r.lediId,
      })),
      ageRanges: ages.map((r) => ({
        immunobiologicalId: r.immunobiologicalId,
        strategyId: r.strategyId ?? undefined,
        minDays: r.minDays,
        maxDays: r.maxDays,
        label: r.label,
      })),
    });
  }

  async catalog() {
    await this.ensureSeeded();
    await this.hydrateOverlaysFromDb();
    const persisted = {
      immunobiologicals: await this.prisma.vaccinationImmunobiological.count(),
      ageRanges: await this.prisma.vaccinationAgeRange.count(),
      overlays: await this.prisma.vaccinationImmunobiological.count({
        where: { source: 'overlay' },
      }),
    };
    return {
      immunobiologicals: getImmunobiologicals(),
      strategies: STRATEGIES,
      doses: DOSES,
      routes: ROUTES,
      sites: SITES,
      attendanceGroups: ATTENDANCE_GROUPS,
      ageRanges: getAgeRanges(),
      stock: STOCK_MVP,
      coldEquipmentKinds: COLD_EQUIPMENT_KINDS,
      coldEquipmentStatuses: COLD_EQUIPMENT_STATUSES,
      thermalBoxStatuses: THERMAL_BOX_STATUSES,
      mapperVersion: 'ledi-vaccination-v2',
      catalogVersion: CATALOG_VERSION,
      seedMeta: { immuno: IMMUNO_SEED_META, age: AGE_SEED_META },
      persisted,
      notes:
        'Catálogo LEDI completo (seed v3) + Prisma. Faixa etária seed PNI (≠ TB e-SUS). Estoque/frio beyond-MVP (equipamento, caixa térmica, leitura manual, insumos leves; sem IoT).',
    };
  }

  async syncCatalog(input: CatalogSyncInput = {}) {
    if (input.reset) {
      await this.prisma.vaccinationImmunobiological.deleteMany({ where: { source: 'overlay' } });
      await this.prisma.vaccinationAgeRange.deleteMany({ where: { source: 'overlay' } });
    }

    if (input.immunobiologicals?.length) {
      for (const row of input.immunobiologicals) {
        if (!row.id || typeof row.lediId !== 'number') continue;
        await this.prisma.vaccinationImmunobiological.upsert({
          where: { id: row.id },
          create: {
            id: row.id,
            lediId: row.lediId,
            code: row.code || row.id,
            label: row.label || row.id,
            active: true,
            source: 'overlay',
          },
          update: {
            lediId: row.lediId,
            code: row.code || row.id,
            label: row.label || row.id,
            active: true,
            source: 'overlay',
          },
        });
      }
    }

    if (input.ageRanges?.length) {
      for (const r of input.ageRanges) {
        await this.prisma.vaccinationAgeRange.create({
          data: {
            immunobiologicalId: r.immunobiologicalId,
            strategyId: r.strategyId ?? null,
            minDays: r.minDays,
            maxDays: r.maxDays,
            label: r.label,
            source: 'overlay',
          },
        });
      }
    }

    await this.hydrateOverlaysFromDb();
    const overlayImmuno = await this.prisma.vaccinationImmunobiological.count({
      where: { source: 'overlay' },
    });
    const overlayAge = await this.prisma.vaccinationAgeRange.count({
      where: { source: 'overlay' },
    });
    return {
      immunobiologicals: getImmunobiologicals().length,
      ageRanges: getAgeRanges().length,
      source: overlayImmuno || overlayAge ? 'seed+overlay' : 'ledi-dictionary-seed',
      catalogVersion: CATALOG_VERSION,
      persisted: true,
      catalog: await this.catalog(),
    };
  }

  listStock(facilityId?: string, immunobiologicalId?: string) {
    return this.prisma.vaccinationStockLot.findMany({
      where: {
        ...(facilityId ? { facilityId } : {}),
        ...(immunobiologicalId ? { immunobiologicalId } : {}),
        active: true,
      },
      orderBy: [{ expiresAt: 'asc' }, { lot: 'asc' }],
      include: {
        facility: { select: { id: true, name: true, cnes: true } },
        coldEquipment: { select: { id: true, code: true, label: true, kind: true } },
      },
    });
  }

  async createStock(dto: CreateVaccinationStockDto) {
    const facility = await this.prisma.facility.findUnique({ where: { id: dto.facilityId } });
    if (!facility) throw new BadRequestException('facilityId inválido');
    const immuno = getImmunobiologicals().find((i) => i.id === dto.immunobiologicalId);
    if (!immuno) throw new BadRequestException('immunobiologicalId inválido');
    if (!dto.lot?.trim()) throw new BadRequestException('lot obrigatório');
    if (
      dto.targetTempMinC != null &&
      dto.targetTempMaxC != null &&
      dto.targetTempMinC > dto.targetTempMaxC
    ) {
      throw new BadRequestException('targetTempMinC não pode ser maior que targetTempMaxC');
    }

    let coldEquipmentId: string | null = null;
    let roomFromEquipment: string | null = null;
    let tempFromEquipment: { min: number; max: number } | null = null;
    if (dto.coldEquipmentId) {
      const eq = await this.prisma.vaccinationColdEquipment.findUnique({
        where: { id: dto.coldEquipmentId },
      });
      if (!eq || !eq.active || eq.facilityId !== dto.facilityId) {
        throw new BadRequestException('coldEquipmentId inválido para a unidade');
      }
      coldEquipmentId = eq.id;
      roomFromEquipment = `${eq.code} — ${eq.label}`;
      tempFromEquipment = { min: eq.targetTempMinC, max: eq.targetTempMaxC };
    }

    const lot = dto.lot.trim();
    const unit = (dto.unit || 'dose').trim() || 'dose';
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('expiresAt inválida');
    }

    const existing = await this.prisma.vaccinationStockLot.findUnique({
      where: {
        facilityId_immunobiologicalId_lot: {
          facilityId: dto.facilityId,
          immunobiologicalId: dto.immunobiologicalId,
          lot,
        },
      },
    });

    let row;
    if (existing) {
      row = await this.prisma.vaccinationStockLot.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + dto.quantity,
          manufacturer: dto.manufacturer?.trim() || existing.manufacturer,
          expiresAt: expiresAt ?? existing.expiresAt,
          unit,
          targetTempMinC:
            dto.targetTempMinC ?? tempFromEquipment?.min ?? existing.targetTempMinC,
          targetTempMaxC:
            dto.targetTempMaxC ?? tempFromEquipment?.max ?? existing.targetTempMaxC,
          roomLabel: dto.roomLabel?.trim() || roomFromEquipment || existing.roomLabel,
          coldEquipmentId: coldEquipmentId ?? existing.coldEquipmentId,
          active: true,
        },
      });
    } else {
      row = await this.prisma.vaccinationStockLot.create({
        data: {
          facilityId: dto.facilityId,
          immunobiologicalId: dto.immunobiologicalId,
          lot,
          manufacturer: dto.manufacturer?.trim() || null,
          expiresAt,
          quantity: dto.quantity,
          unit,
          targetTempMinC: dto.targetTempMinC ?? tempFromEquipment?.min ?? 2,
          targetTempMaxC: dto.targetTempMaxC ?? tempFromEquipment?.max ?? 8,
          roomLabel: dto.roomLabel?.trim() || roomFromEquipment || null,
          coldEquipmentId,
          active: true,
        },
      });
    }

    await this.prisma.vaccinationStockMovement.create({
      data: {
        stockLotId: row.id,
        kind: 'ENTRY',
        quantityDelta: dto.quantity,
        note: dto.note || (existing ? 'Entrada adicional no lote' : 'Entrada inicial'),
      },
    });

    await this.prisma.audit('create', 'vaccination_stock', row.id, [RF.VACCINATION.id], {
      facilityId: dto.facilityId,
      immunobiologicalId: dto.immunobiologicalId,
      lot,
      quantity: dto.quantity,
      previousQuantity: existing?.quantity ?? 0,
      coldEquipmentId,
    });

    return {
      ...row,
      stock: STOCK_MVP,
      entry: { quantity: dto.quantity, previousQuantity: existing?.quantity ?? 0 },
    };
  }

  // ─── Equipamentos frios / caixa térmica / leituras (RF-14.17–19) ───

  listColdEquipment(facilityId?: string) {
    return this.prisma.vaccinationColdEquipment.findMany({
      where: {
        ...(facilityId ? { facilityId } : {}),
        active: true,
      },
      orderBy: [{ code: 'asc' }],
    });
  }

  async createColdEquipment(dto: CreateColdEquipmentDto) {
    const facility = await this.prisma.facility.findUnique({ where: { id: dto.facilityId } });
    if (!facility) throw new BadRequestException('facilityId inválido');
    const code = dto.code.trim();
    const label = dto.label.trim();
    if (!code || !label) throw new BadRequestException('code e label obrigatórios');
    const kind = (dto.kind || 'REFRIGERATOR').trim().toUpperCase();
    if (!COLD_EQUIPMENT_KINDS.some((k) => k.id === kind)) {
      throw new BadRequestException(`kind inválido (use: ${COLD_EQUIPMENT_KINDS.map((k) => k.id).join(', ')})`);
    }
    if (dto.targetTempMinC > dto.targetTempMaxC) {
      throw new BadRequestException('targetTempMinC não pode ser maior que targetTempMaxC');
    }
    const status = (dto.status || 'ACTIVE').trim().toUpperCase();
    if (!COLD_EQUIPMENT_STATUSES.some((s) => s.id === status)) {
      throw new BadRequestException('status inválido');
    }

    const row = await this.prisma.vaccinationColdEquipment.create({
      data: {
        facilityId: dto.facilityId,
        code,
        label,
        kind,
        targetTempMinC: dto.targetTempMinC,
        targetTempMaxC: dto.targetTempMaxC,
        status,
        active: true,
      },
    });
    await this.prisma.audit('create', 'vaccination_cold_equipment', row.id, [RF.VACCINATION.id], {
      facilityId: dto.facilityId,
      code,
      kind,
    });
    return { ...row, stock: STOCK_MVP };
  }

  async patchColdEquipment(id: string, dto: PatchColdEquipmentDto) {
    const existing = await this.prisma.vaccinationColdEquipment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Equipamento frio não encontrado');
    const kind = dto.kind?.trim().toUpperCase();
    if (kind && !COLD_EQUIPMENT_KINDS.some((k) => k.id === kind)) {
      throw new BadRequestException('kind inválido');
    }
    const status = dto.status?.trim().toUpperCase();
    if (status && !COLD_EQUIPMENT_STATUSES.some((s) => s.id === status)) {
      throw new BadRequestException('status inválido');
    }
    const min = dto.targetTempMinC ?? existing.targetTempMinC;
    const max = dto.targetTempMaxC ?? existing.targetTempMaxC;
    if (min > max) throw new BadRequestException('targetTempMinC não pode ser maior que targetTempMaxC');

    const row = await this.prisma.vaccinationColdEquipment.update({
      where: { id },
      data: {
        ...(dto.label != null ? { label: dto.label.trim() } : {}),
        ...(kind ? { kind } : {}),
        ...(dto.targetTempMinC != null ? { targetTempMinC: dto.targetTempMinC } : {}),
        ...(dto.targetTempMaxC != null ? { targetTempMaxC: dto.targetTempMaxC } : {}),
        ...(status ? { status } : {}),
        ...(dto.active != null ? { active: dto.active } : {}),
      },
    });
    await this.prisma.audit('update', 'vaccination_cold_equipment', id, [RF.VACCINATION.id], {
      ...dto,
    });
    return row;
  }

  listThermalBoxes(facilityId?: string) {
    return this.prisma.vaccinationThermalBox.findMany({
      where: {
        ...(facilityId ? { facilityId } : {}),
        active: true,
      },
      orderBy: [{ code: 'asc' }],
      include: {
        coldEquipment: { select: { id: true, code: true, label: true } },
      },
    });
  }

  async createThermalBox(dto: CreateThermalBoxDto) {
    const facility = await this.prisma.facility.findUnique({ where: { id: dto.facilityId } });
    if (!facility) throw new BadRequestException('facilityId inválido');
    const code = dto.code.trim();
    const label = dto.label.trim();
    if (!code || !label) throw new BadRequestException('code e label obrigatórios');
    const status = (dto.status || 'AVAILABLE').trim().toUpperCase();
    if (!THERMAL_BOX_STATUSES.some((s) => s.id === status)) {
      throw new BadRequestException('status inválido');
    }
    let coldEquipmentId: string | null = null;
    if (dto.coldEquipmentId) {
      const eq = await this.prisma.vaccinationColdEquipment.findUnique({
        where: { id: dto.coldEquipmentId },
      });
      if (!eq || !eq.active || eq.facilityId !== dto.facilityId) {
        throw new BadRequestException('coldEquipmentId inválido para a unidade');
      }
      coldEquipmentId = eq.id;
    }
    if (
      dto.targetTempMinC != null &&
      dto.targetTempMaxC != null &&
      dto.targetTempMinC > dto.targetTempMaxC
    ) {
      throw new BadRequestException('targetTempMinC não pode ser maior que targetTempMaxC');
    }

    const row = await this.prisma.vaccinationThermalBox.create({
      data: {
        facilityId: dto.facilityId,
        code,
        label,
        coldEquipmentId,
        targetTempMinC: dto.targetTempMinC ?? 2,
        targetTempMaxC: dto.targetTempMaxC ?? 8,
        status,
        active: true,
      },
    });
    await this.prisma.audit('create', 'vaccination_thermal_box', row.id, [RF.VACCINATION.id], {
      facilityId: dto.facilityId,
      code,
    });
    return { ...row, stock: STOCK_MVP };
  }

  async patchThermalBox(id: string, dto: PatchThermalBoxDto) {
    const existing = await this.prisma.vaccinationThermalBox.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Caixa térmica não encontrada');
    const status = dto.status?.trim().toUpperCase();
    if (status && !THERMAL_BOX_STATUSES.some((s) => s.id === status)) {
      throw new BadRequestException('status inválido');
    }
    let coldEquipmentId = existing.coldEquipmentId;
    if (dto.coldEquipmentId !== undefined) {
      if (!dto.coldEquipmentId) {
        coldEquipmentId = null;
      } else {
        const eq = await this.prisma.vaccinationColdEquipment.findUnique({
          where: { id: dto.coldEquipmentId },
        });
        if (!eq || !eq.active || eq.facilityId !== existing.facilityId) {
          throw new BadRequestException('coldEquipmentId inválido para a unidade');
        }
        coldEquipmentId = eq.id;
      }
    }
    const min = dto.targetTempMinC ?? existing.targetTempMinC ?? 2;
    const max = dto.targetTempMaxC ?? existing.targetTempMaxC ?? 8;
    if (min > max) throw new BadRequestException('targetTempMinC não pode ser maior que targetTempMaxC');

    const row = await this.prisma.vaccinationThermalBox.update({
      where: { id },
      data: {
        ...(dto.label != null ? { label: dto.label.trim() } : {}),
        coldEquipmentId,
        ...(dto.targetTempMinC != null ? { targetTempMinC: dto.targetTempMinC } : {}),
        ...(dto.targetTempMaxC != null ? { targetTempMaxC: dto.targetTempMaxC } : {}),
        ...(status ? { status } : {}),
        ...(dto.active != null ? { active: dto.active } : {}),
      },
    });
    await this.prisma.audit('update', 'vaccination_thermal_box', id, [RF.VACCINATION.id], {
      ...dto,
    });
    return row;
  }

  listTempReadings(facilityId?: string, limit = 50) {
    const take = Math.min(Math.max(limit || 50, 1), 200);
    return this.prisma.vaccinationTempReading.findMany({
      where: facilityId ? { facilityId } : {},
      orderBy: { recordedAt: 'desc' },
      take,
      include: {
        coldEquipment: { select: { id: true, code: true, label: true } },
        thermalBox: { select: { id: true, code: true, label: true } },
      },
    });
  }

  async createTempReading(dto: CreateTempReadingDto) {
    const facility = await this.prisma.facility.findUnique({ where: { id: dto.facilityId } });
    if (!facility) throw new BadRequestException('facilityId inválido');
    if (!dto.coldEquipmentId && !dto.thermalBoxId) {
      throw new BadRequestException('Informe coldEquipmentId ou thermalBoxId');
    }

    let min: number | null = null;
    let max: number | null = null;
    let coldEquipmentId: string | null = null;
    let thermalBoxId: string | null = null;

    if (dto.coldEquipmentId) {
      const eq = await this.prisma.vaccinationColdEquipment.findUnique({
        where: { id: dto.coldEquipmentId },
      });
      if (!eq || !eq.active || eq.facilityId !== dto.facilityId) {
        throw new BadRequestException('coldEquipmentId inválido para a unidade');
      }
      coldEquipmentId = eq.id;
      min = eq.targetTempMinC;
      max = eq.targetTempMaxC;
    }
    if (dto.thermalBoxId) {
      const box = await this.prisma.vaccinationThermalBox.findUnique({
        where: { id: dto.thermalBoxId },
      });
      if (!box || !box.active || box.facilityId !== dto.facilityId) {
        throw new BadRequestException('thermalBoxId inválido para a unidade');
      }
      thermalBoxId = box.id;
      if (min == null) min = box.targetTempMinC;
      if (max == null) max = box.targetTempMaxC;
    }

    const recordedAt = dto.recordedAt ? new Date(dto.recordedAt) : new Date();
    if (Number.isNaN(recordedAt.getTime())) throw new BadRequestException('recordedAt inválida');
    const withinRange =
      min != null && max != null ? dto.temperatureC >= min && dto.temperatureC <= max : true;

    const row = await this.prisma.vaccinationTempReading.create({
      data: {
        facilityId: dto.facilityId,
        coldEquipmentId,
        thermalBoxId,
        temperatureC: dto.temperatureC,
        recordedAt,
        withinRange,
        note: dto.note?.trim() || null,
      },
    });
    await this.prisma.audit('create', 'vaccination_temp_reading', row.id, [RF.VACCINATION.id], {
      facilityId: dto.facilityId,
      temperatureC: dto.temperatureC,
      withinRange,
      coldEquipmentId,
      thermalBoxId,
    });
    return {
      ...row,
      targetRange: min != null && max != null ? { min, max } : null,
      stock: STOCK_MVP,
    };
  }

  // ─── Insumos leves (RF-14.4 / 14.6) ───

  listSupplies(facilityId?: string) {
    return this.prisma.vaccinationSupply.findMany({
      where: {
        ...(facilityId ? { facilityId } : {}),
        active: true,
      },
      orderBy: [{ sku: 'asc' }],
      include: {
        links: {
          where: { active: true },
          select: { id: true, immunobiologicalId: true, qtyPerDose: true },
        },
      },
    });
  }

  async createSupply(dto: CreateSupplyDto) {
    const facility = await this.prisma.facility.findUnique({ where: { id: dto.facilityId } });
    if (!facility) throw new BadRequestException('facilityId inválido');
    const sku = dto.sku.trim();
    const label = dto.label.trim();
    if (!sku || !label) throw new BadRequestException('sku e label obrigatórios');

    const existing = await this.prisma.vaccinationSupply.findUnique({
      where: { facilityId_sku: { facilityId: dto.facilityId, sku } },
    });
    if (existing) {
      const row = await this.prisma.vaccinationSupply.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + dto.quantity,
          label,
          unit: (dto.unit || existing.unit || 'un').trim() || 'un',
          active: true,
        },
      });
      if (dto.quantity > 0) {
        await this.prisma.vaccinationSupplyMovement.create({
          data: {
            supplyId: row.id,
            kind: 'ENTRY',
            quantityDelta: dto.quantity,
            note: 'Entrada adicional no SKU',
          },
        });
      }
      await this.prisma.audit('create', 'vaccination_supply', row.id, [RF.VACCINATION.id], {
        facilityId: dto.facilityId,
        sku,
        quantity: dto.quantity,
        previousQuantity: existing.quantity,
      });
      return { ...row, stock: STOCK_MVP, entry: { quantity: dto.quantity, previousQuantity: existing.quantity } };
    }

    const row = await this.prisma.vaccinationSupply.create({
      data: {
        facilityId: dto.facilityId,
        sku,
        label,
        unit: (dto.unit || 'un').trim() || 'un',
        quantity: dto.quantity,
        active: true,
      },
    });
    if (dto.quantity > 0) {
      await this.prisma.vaccinationSupplyMovement.create({
        data: {
          supplyId: row.id,
          kind: 'ENTRY',
          quantityDelta: dto.quantity,
          note: 'Entrada inicial',
        },
      });
    }
    await this.prisma.audit('create', 'vaccination_supply', row.id, [RF.VACCINATION.id], {
      facilityId: dto.facilityId,
      sku,
      quantity: dto.quantity,
    });
    return { ...row, stock: STOCK_MVP, entry: { quantity: dto.quantity, previousQuantity: 0 } };
  }

  async supplyEntry(id: string, dto: SupplyEntryDto) {
    const existing = await this.prisma.vaccinationSupply.findUnique({ where: { id } });
    if (!existing || !existing.active) throw new NotFoundException('Insumo não encontrado');
    const row = await this.prisma.vaccinationSupply.update({
      where: { id },
      data: { quantity: existing.quantity + dto.quantity },
    });
    await this.prisma.vaccinationSupplyMovement.create({
      data: {
        supplyId: id,
        kind: 'ENTRY',
        quantityDelta: dto.quantity,
        note: dto.note || 'Entrada de insumos',
      },
    });
    return { ...row, entry: { quantity: dto.quantity, previousQuantity: existing.quantity } };
  }

  listSupplyLinks(immunobiologicalId?: string, facilityId?: string) {
    return this.prisma.vaccinationSupplyLink.findMany({
      where: {
        active: true,
        ...(immunobiologicalId ? { immunobiologicalId } : {}),
        ...(facilityId ? { supply: { facilityId } } : {}),
      },
      include: {
        supply: {
          select: {
            id: true,
            facilityId: true,
            sku: true,
            label: true,
            unit: true,
            quantity: true,
          },
        },
      },
      orderBy: [{ immunobiologicalId: 'asc' }],
    });
  }

  async createSupplyLink(dto: CreateSupplyLinkDto) {
    const immuno = getImmunobiologicals().find((i) => i.id === dto.immunobiologicalId);
    if (!immuno) throw new BadRequestException('immunobiologicalId inválido');
    const supply = await this.prisma.vaccinationSupply.findUnique({ where: { id: dto.supplyId } });
    if (!supply || !supply.active) throw new BadRequestException('supplyId inválido');
    const qtyPerDose = dto.qtyPerDose ?? 1;

    const row = await this.prisma.vaccinationSupplyLink.upsert({
      where: {
        immunobiologicalId_supplyId: {
          immunobiologicalId: dto.immunobiologicalId,
          supplyId: dto.supplyId,
        },
      },
      create: {
        immunobiologicalId: dto.immunobiologicalId,
        supplyId: dto.supplyId,
        qtyPerDose,
        active: true,
      },
      update: { qtyPerDose, active: true },
      include: {
        supply: { select: { id: true, sku: true, label: true, unit: true, facilityId: true } },
      },
    });
    await this.prisma.audit('create', 'vaccination_supply_link', row.id, [RF.VACCINATION.id], {
      immunobiologicalId: dto.immunobiologicalId,
      supplyId: dto.supplyId,
      qtyPerDose,
    });
    return { ...row, stock: STOCK_MVP };
  }

  /**
   * Baixa 1 dose por aplicação quando existir lote de estoque
   * (facility + imuno + número do lote). Sem estoque → não bloqueia.
   */
  private async applyStockDecrements(
    facilityId: string,
    vaccinationRecordId: string,
    applications: VaccineApplicationInput[],
  ): Promise<VaccineApplicationInput[]> {
    const out: VaccineApplicationInput[] = [];
    for (const app of applications) {
      const lot = (app.lot || '').trim();
      if (!lot) {
        out.push(app);
        continue;
      }
      const stock = await this.prisma.vaccinationStockLot.findUnique({
        where: {
          facilityId_immunobiologicalId_lot: {
            facilityId,
            immunobiologicalId: app.immunobiologicalId,
            lot,
          },
        },
      });
      if (!stock || !stock.active) {
        out.push(app);
        continue;
      }
      if (stock.quantity < 1) {
        throw new BadRequestException(
          `Estoque insuficiente para ${app.immunobiologicalId} lote ${lot} (qty=${stock.quantity}).`,
        );
      }
      await this.prisma.vaccinationStockLot.update({
        where: { id: stock.id },
        data: { quantity: stock.quantity - 1 },
      });
      await this.prisma.vaccinationStockMovement.create({
        data: {
          stockLotId: stock.id,
          kind: 'APPLY',
          quantityDelta: -1,
          vaccinationRecordId,
          note: `Baixa por aplicação ${vaccinationRecordId.slice(0, 8)}`,
        },
      });
      out.push({ ...app, stockLotId: stock.id });
    }
    return out;
  }

  /** Devolve qty das baixas APPLY ainda não estornadas deste registro. */
  private async restoreStockOnVoid(vaccinationRecordId: string) {
    const applies = await this.prisma.vaccinationStockMovement.findMany({
      where: { vaccinationRecordId, kind: 'APPLY' },
    });
    const restored: Array<{ stockLotId: string; quantity: number }> = [];
    for (const mov of applies) {
      const already = await this.prisma.vaccinationStockMovement.findFirst({
        where: {
          vaccinationRecordId,
          stockLotId: mov.stockLotId,
          kind: 'VOID_RETURN',
        },
      });
      if (already) continue;
      const qty = Math.abs(mov.quantityDelta) || 1;
      await this.prisma.vaccinationStockLot.update({
        where: { id: mov.stockLotId },
        data: { quantity: { increment: qty }, active: true },
      });
      await this.prisma.vaccinationStockMovement.create({
        data: {
          stockLotId: mov.stockLotId,
          kind: 'VOID_RETURN',
          quantityDelta: qty,
          vaccinationRecordId,
          note: `Estorno void ${vaccinationRecordId.slice(0, 8)}`,
        },
      });
      restored.push({ stockLotId: mov.stockLotId, quantity: qty });
    }
    return restored;
  }

  /**
   * Baixa insumos vinculados ao imuno na unidade (RF-14.4/14.6).
   * Sem vínculo → no-op. Qty insuficiente → 400.
   */
  private async applySupplyDecrements(
    facilityId: string,
    vaccinationRecordId: string,
    applications: VaccineApplicationInput[],
  ): Promise<Array<{ supplyId: string; sku: string; quantity: number; immunobiologicalId: string }>> {
    const consumed: Array<{
      supplyId: string;
      sku: string;
      quantity: number;
      immunobiologicalId: string;
    }> = [];
    for (const app of applications) {
      const links = await this.prisma.vaccinationSupplyLink.findMany({
        where: {
          immunobiologicalId: app.immunobiologicalId,
          active: true,
          supply: { facilityId, active: true },
        },
        include: { supply: true },
      });
      for (const link of links) {
        const need = link.qtyPerDose || 1;
        const fresh = await this.prisma.vaccinationSupply.findUnique({ where: { id: link.supplyId } });
        if (!fresh || !fresh.active) continue;
        if (fresh.quantity < need) {
          throw new BadRequestException(
            `Insumo insuficiente ${fresh.sku} para ${app.immunobiologicalId} ` +
              `(qty=${fresh.quantity}, precisa=${need}).`,
          );
        }
        await this.prisma.vaccinationSupply.update({
          where: { id: link.supplyId },
          data: { quantity: { decrement: need } },
        });
        await this.prisma.vaccinationSupplyMovement.create({
          data: {
            supplyId: link.supplyId,
            kind: 'APPLY',
            quantityDelta: -need,
            vaccinationRecordId,
            note: `Baixa por aplicação ${vaccinationRecordId.slice(0, 8)} (${app.immunobiologicalId})`,
          },
        });
        consumed.push({
          supplyId: link.supplyId,
          sku: fresh.sku,
          quantity: need,
          immunobiologicalId: app.immunobiologicalId,
        });
      }
    }
    return consumed;
  }

  private async restoreSuppliesOnVoid(vaccinationRecordId: string) {
    const applies = await this.prisma.vaccinationSupplyMovement.findMany({
      where: { vaccinationRecordId, kind: 'APPLY' },
    });
    const restored: Array<{ supplyId: string; quantity: number }> = [];
    for (const mov of applies) {
      const already = await this.prisma.vaccinationSupplyMovement.findFirst({
        where: {
          vaccinationRecordId,
          supplyId: mov.supplyId,
          kind: 'VOID_RETURN',
        },
      });
      if (already) continue;
      const qty = Math.abs(mov.quantityDelta) || 1;
      await this.prisma.vaccinationSupply.update({
        where: { id: mov.supplyId },
        data: { quantity: { increment: qty }, active: true },
      });
      await this.prisma.vaccinationSupplyMovement.create({
        data: {
          supplyId: mov.supplyId,
          kind: 'VOID_RETURN',
          quantityDelta: qty,
          vaccinationRecordId,
          note: `Estorno void ${vaccinationRecordId.slice(0, 8)}`,
        },
      });
      restored.push({ supplyId: mov.supplyId, quantity: qty });
    }
    return restored;
  }

  private parseApps(json: string): VaccineApplicationInput[] {
    return JSON.parse(json || '[]') as VaccineApplicationInput[];
  }

  list(patientId?: string, facilityId?: string) {
    return this.prisma.vaccinationRecord.findMany({
      where: {
        ...(patientId ? { patientId } : {}),
        ...(facilityId ? { facilityId } : {}),
      },
      orderBy: { appliedAt: 'desc' },
      include: { patient: true, facility: true, professional: true },
    });
  }

  async get(id: string) {
    const row = await this.prisma.vaccinationRecord.findUnique({
      where: { id },
      include: { patient: true, facility: true, professional: true },
    });
    if (!row) throw new NotFoundException('Registro de vacinação não encontrado');
    return { ...row, applications: this.parseApps(row.applicationsJson) };
  }

  async card(patientId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('Paciente não encontrado');
    const records = await this.prisma.vaccinationRecord.findMany({
      where: {
        patientId,
        status: { in: ['READY', 'SENT', 'DRAFT'] },
      },
      orderBy: { appliedAt: 'desc' },
    });
    const doses = records.flatMap((r) => {
      const apps = this.parseApps(r.applicationsJson);
      return apps.map((a) => ({
        date: r.appliedAt.toISOString().slice(0, 10),
        immunobiological: a.immunobiologicalId,
        dose: a.doseId,
        lot: a.lot,
        strategy: a.strategyId,
        recordId: r.id,
        status: r.status,
      }));
    });
    return {
      patientId,
      patientName: patient.socialName || patient.civilName,
      cpf: patient.cpf,
      cns: patient.cns,
      birthDate: patient.birthDate?.toISOString().slice(0, 10) ?? null,
      sex: patient.sex,
      doses,
    };
  }

  async cardPdf(patientId: string): Promise<Buffer> {
    const card = await this.card(patientId);
    return buildVaccinationCardPdf({
      patientId: card.patientId,
      patientName: card.patientName,
      cpf: card.cpf,
      cns: card.cns,
      birthDate: card.birthDate,
      sex: card.sex,
      doses: card.doses,
      municipio: process.env.MUNICIPIO_NOME || 'Franca',
    });
  }

  /**
   * Anula registro de vacinação → VOID (local).
   * READY/SENT/DRAFT: exige acknowledgeLocalOnly (sem recall Ministério/Siaps).
   */
  async void(id: string, dto: VoidVaccinationDto = {}) {
    const row = await this.prisma.vaccinationRecord.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Registro de vacinação não encontrado');
    if (row.status === 'VOID') {
      return {
        ...(await this.get(id)),
        voidMeta: {
          alreadyVoid: true,
          localOnly: true,
          ministryRecall: false,
          warning: null as string | null,
        },
      };
    }
    if (!['DRAFT', 'READY', 'SENT'].includes(row.status)) {
      throw new BadRequestException(`Status ${row.status} não permite anulação`);
    }
    if (!dto.acknowledgeLocalOnly) {
      throw new BadRequestException(
        'Anulação exige acknowledgeLocalOnly=true (anulação local no SIGS; sem recall no Ministério/Siaps).',
      );
    }

    let batchStatusBefore: string | null = null;
    let batchPayload: Record<string, unknown> = {};
    if (row.productionBatchId) {
      const batch = await this.prisma.productionBatch.findUnique({
        where: { id: row.productionBatchId },
      });
      batchStatusBefore = batch?.status ?? null;
      try {
        batchPayload = JSON.parse(batch?.payloadJson || '{}') as Record<string, unknown>;
      } catch {
        batchPayload = {};
      }
    }

    const updated = await this.prisma.vaccinationRecord.update({
      where: { id },
      data: {
        status: 'VOID',
        voidReason: dto.reason || null,
        voidedAt: new Date(),
      },
      include: { patient: true, facility: true, professional: true },
    });

    const stockRestored = await this.restoreStockOnVoid(id);
    const suppliesRestored = await this.restoreSuppliesOnVoid(id);

    if (row.productionBatchId) {
      const voidMeta = {
        ...batchPayload,
        voided: true,
        voidAt: new Date().toISOString(),
        voidReason: dto.reason || null,
        ministryRecall: false,
        bucket: 'incomplete',
        stockRestored,
        suppliesRestored,
      };
      await this.prisma.productionBatch.update({
        where: { id: row.productionBatchId },
        data: {
          status: 'error',
          errorMessage: 'VOID local vacinação — sem recall Ministério/Siaps',
          payloadJson: JSON.stringify(voidMeta),
          statusChangedAt: new Date(),
        },
      });
    }

    await this.prisma.audit('void', 'vaccination', id, [RF.VACCINATION.id, RF.PROD.id], {
      reason: dto.reason || null,
      productionBatchId: row.productionBatchId,
      previousStatus: row.status,
      acknowledgeLocalOnly: true,
      batchStatusBefore,
      ministryRecall: false,
      stockRestored,
      suppliesRestored,
    });

    return {
      ...updated,
      applications: this.parseApps(updated.applicationsJson),
      voidMeta: {
        alreadyVoid: false,
        localOnly: true,
        ministryRecall: false,
        batchStatusBefore,
        stockRestored,
        suppliesRestored,
        warning:
          'Anulação local no SIGS. Não há estorno/XML de exclusão no Ministério; se o XML já foi enviado, trate o recall pelos canais oficiais.',
      },
    };
  }

  async create(dto: CreateVaccinationDto) {
    const errors = validateVaccineApplications(dto.applications);
    if (errors.length) throw new BadRequestException({ errors });

    const patient = await this.prisma.patient.findUnique({ where: { id: dto.patientId } });
    if (!patient) throw new BadRequestException('patientId inválido');
    const facility = await this.prisma.facility.findUnique({ where: { id: dto.facilityId } });
    if (!facility) throw new BadRequestException('facilityId inválido');
    if (dto.professionalId) {
      const prof = await this.prisma.professional.findUnique({ where: { id: dto.professionalId } });
      if (!prof) throw new BadRequestException('professionalId inválido');
    }

    const appliedAt = dto.appliedAt ? new Date(dto.appliedAt) : new Date();
    const ageErrors = validateAgeForApplications(dto.applications, patient.birthDate, appliedAt);
    if (ageErrors.length) throw new BadRequestException({ errors: ageErrors });

    const uuidFicha = randomUUID();
    let teamIne: string | null = null;
    if (dto.teamId) {
      const team = await this.prisma.team.findUnique({ where: { id: dto.teamId } });
      teamIne = team?.ine ?? null;
    }

    const professional = dto.professionalId
      ? await this.prisma.professional.findUnique({ where: { id: dto.professionalId } })
      : null;

    const assignments = dto.professionalId
      ? await this.prisma.professionalAssignment.findMany({
          where: {
            professionalId: dto.professionalId,
            facilityId: dto.facilityId,
            active: true,
          },
          include: { professional: true, facility: true, team: true },
        })
      : [];

    let lotacao;
    try {
      lotacao = resolveLotacaoHeader({
        facilityCnes: facility.cnes,
        professionalCns: professional?.cns,
        teamIne,
        cboOverride: dto.cbo,
        assignmentId: dto.assignmentId,
        assignments,
        professionalId: dto.professionalId,
        facilityId: dto.facilityId,
        teamId: dto.teamId,
      });
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    let payload;
    try {
      payload = buildVaccinationLediPayload({
        uuidFicha,
        lotacao,
        codigoIbgeMunicipio: facility.ibgeCode,
        appliedAt,
        shift: dto.shift,
        careLocation: dto.careLocation,
        patient,
        applications: dto.applications,
      });
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    const batch = await this.prisma.productionBatch.create({
      data: {
        kind: 'vaccination',
        status: 'ready',
        rfIdsCsv: [RF.VACCINATION.id, RF.ESUS.id, RF.PROD.id].join(','),
        payloadJson: JSON.stringify(payload),
      },
    });

    const row = await this.prisma.vaccinationRecord.create({
      data: {
        patientId: dto.patientId,
        facilityId: dto.facilityId,
        professionalId: dto.professionalId,
        shift: dto.shift,
        careLocation: dto.careLocation,
        appliedAt,
        status: 'READY',
        applicationsJson: JSON.stringify(dto.applications),
        productionBatchId: batch.id,
      },
    });

    let applicationsWithStock = dto.applications as VaccineApplicationInput[];
    let stockDecrements: Array<{ immunobiologicalId: string; lot: string; stockLotId: string }> = [];
    let supplyDecrements: Array<{
      supplyId: string;
      sku: string;
      quantity: number;
      immunobiologicalId: string;
    }> = [];
    try {
      applicationsWithStock = await this.applyStockDecrements(
        dto.facilityId,
        row.id,
        dto.applications,
      );
      stockDecrements = applicationsWithStock
        .filter((a) => a.stockLotId)
        .map((a) => ({
          immunobiologicalId: a.immunobiologicalId,
          lot: a.lot,
          stockLotId: a.stockLotId!,
        }));
      supplyDecrements = await this.applySupplyDecrements(
        dto.facilityId,
        row.id,
        applicationsWithStock,
      );
      if (stockDecrements.length) {
        await this.prisma.vaccinationRecord.update({
          where: { id: row.id },
          data: { applicationsJson: JSON.stringify(applicationsWithStock) },
        });
      }
    } catch (e) {
      await this.restoreStockOnVoid(row.id);
      await this.restoreSuppliesOnVoid(row.id);
      await this.prisma.vaccinationRecord.update({
        where: { id: row.id },
        data: {
          status: 'VOID',
          voidReason: 'Falha na baixa de estoque/insumos — registro anulado automaticamente',
          voidedAt: new Date(),
        },
      });
      await this.prisma.productionBatch.update({
        where: { id: batch.id },
        data: {
          status: 'error',
          errorMessage: (e as Error).message,
          statusChangedAt: new Date(),
        },
      });
      throw e;
    }

    await this.prisma.audit('create', 'vaccination', row.id, [RF.VACCINATION.id, RF.PROD.id], {
      productionBatchId: batch.id,
      uuidFicha,
      stockDecrements,
      supplyDecrements,
    });

    await this.clinicalCore
      .persistNativeEncounter({
        fichaTipo: 'VAC',
        encounterId: row.id,
        uuidFicha,
        status: 'finished',
        periodStart: appliedAt.toISOString(),
        periodEnd: appliedAt.toISOString(),
        patient: {
          id: patient.id,
          civilName: patient.civilName,
          cpf: patient.cpf,
          cns: patient.cns,
          birthDate: patient.birthDate,
          sex: patient.sex,
        },
        practitionerCns: lotacao.profissionalCNS,
        cbo: lotacao.cboCodigo_2002,
        cnes: lotacao.cnes,
        ine: lotacao.ine,
        ibgeMunicipio: facility.ibgeCode,
        procedures: applicationsWithStock.map((a) => ({
          code: `VAC:${a.immunobiologicalId}:${a.doseId}`,
          quantity: 1,
        })),
        conditions: [],
        extensions: {
          kind: 'vaccination',
          applications: applicationsWithStock,
          mapperVersion: 'ledi-vaccination-v2',
          stockDecrements,
          supplyDecrements,
        },
      })
      .catch(() => undefined);

    return {
      record: { ...row, applications: applicationsWithStock, applicationsJson: JSON.stringify(applicationsWithStock) },
      productionBatch: { id: batch.id, kind: batch.kind, status: batch.status, payload },
      stock: { decrements: stockDecrements, supplyDecrements, meta: STOCK_MVP },
    };
  }
}
