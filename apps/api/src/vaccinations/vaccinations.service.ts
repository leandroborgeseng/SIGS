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
  DOSES,
  IMMUNOBIOLOGICALS_SEED,
  IMMUNO_SEED_META,
  ROUTES,
  SITES,
  STOCK_STUB,
  STRATEGIES,
  VaccineApplicationInput,
  getAgeRanges,
  getImmunobiologicals,
  replaceOverlays,
  validateAgeForApplications,
  validateVaccineApplications,
  type CatalogSyncInput,
} from './catalog';
import { CreateVaccinationDto, VoidVaccinationDto } from './dto';
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
      stock: STOCK_STUB,
      mapperVersion: 'ledi-vaccination-v2',
      catalogVersion: CATALOG_VERSION,
      seedMeta: { immuno: IMMUNO_SEED_META, age: AGE_SEED_META },
      persisted,
      notes:
        'Catálogo LEDI completo (seed v3) + Prisma. Faixa etária seed PNI (≠ TB e-SUS). Estoque/frio stub.',
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

    if (row.productionBatchId) {
      const voidMeta = {
        ...batchPayload,
        voided: true,
        voidAt: new Date().toISOString(),
        voidReason: dto.reason || null,
        ministryRecall: false,
        bucket: 'incomplete',
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
    });

    return {
      ...updated,
      applications: this.parseApps(updated.applicationsJson),
      voidMeta: {
        alreadyVoid: false,
        localOnly: true,
        ministryRecall: false,
        batchStatusBefore,
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

    await this.prisma.audit('create', 'vaccination', row.id, [RF.VACCINATION.id, RF.PROD.id], {
      productionBatchId: batch.id,
      uuidFicha,
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
        procedures: dto.applications.map((a) => ({
          code: `VAC:${a.immunobiologicalId}:${a.doseId}`,
          quantity: 1,
        })),
        conditions: [],
        extensions: {
          kind: 'vaccination',
          applications: dto.applications,
          mapperVersion: 'ledi-vaccination-v2',
        },
      })
      .catch(() => undefined);

    return {
      record: { ...row, applications: dto.applications },
      productionBatch: { id: batch.id, kind: batch.kind, status: batch.status, payload },
    };
  }
}
