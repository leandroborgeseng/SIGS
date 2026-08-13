/**
 * Fluxo mínimo API: open → patch → finish odonto → aparece na faturamento-queue (+ sync).
 * Prisma mock em memória (sem DB real).
 */
import { CareExtraService } from './care-extra.service';
import { competenciaFromDate } from './dental-billing-queue';

const PATIENT = {
  id: 'p1',
  civilName: 'Paciente Teste',
  socialName: null as string | null,
  cpf: '52998224725',
  cns: null as string | null,
  birthDate: new Date('1990-01-01T00:00:00.000Z'),
  sex: 'F',
};

const FACILITY = {
  id: 'f1',
  name: 'UBS Teste',
  cnes: '9647198',
  ibgeCode: '3516200',
};

const PROFESSIONAL = {
  id: 'prof1',
  civilName: 'Dr. Odonto',
  cns: '126090861660005',
};

const ASSIGNMENT = {
  id: 'asg1',
  professionalId: PROFESSIONAL.id,
  facilityId: FACILITY.id,
  teamId: 'team1',
  cbo: '223208',
  active: true,
  professional: PROFESSIONAL,
  facility: FACILITY,
  team: { id: 'team1', ine: '0002165929' },
};

type DentalRow = {
  id: string;
  patientId: string;
  facilityId: string;
  professionalId: string | null;
  assignmentId: string | null;
  encounterType: string;
  status: string;
  anamnese: string | null;
  proceduresJson: string;
  odontogramJson: string;
  outcomesJson: string;
  careJson: string;
  startedAt: Date;
  finishedAt: Date | null;
  productionBatchId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type BatchRow = {
  id: string;
  kind: string;
  status: string;
  rfIdsCsv: string;
  payloadJson: string;
  errorMessage: string | null;
  statusChangedAt: Date;
};

function withIncludes(row: DentalRow) {
  return {
    ...row,
    patient: PATIENT,
    facility: FACILITY,
    professional: row.professionalId ? PROFESSIONAL : null,
  };
}

type EncounterQuery = {
  where?: {
    status?: { in: string[] };
    startedAt?: { gte: Date; lt: Date };
    facilityId?: string;
    id?: { in: string[] };
  };
  take?: number;
};

function filterEncounters(encounters: Map<string, DentalRow>, args?: EncounterQuery): DentalRow[] {
  let rows = [...encounters.values()];
  const w = args?.where;
  if (w?.id?.in) rows = rows.filter((r) => w.id!.in.includes(r.id));
  if (w?.status?.in) rows = rows.filter((r) => w.status!.in.includes(r.status));
  if (w?.facilityId) rows = rows.filter((r) => r.facilityId === w.facilityId);
  if (w?.startedAt) {
    rows = rows.filter((r) => r.startedAt >= w.startedAt!.gte && r.startedAt < w.startedAt!.lt);
  }
  rows.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  if (args?.take != null) rows = rows.slice(0, args.take);
  return rows;
}

function createPrismaMemory() {
  const encounters = new Map<string, DentalRow>();
  const batches = new Map<string, BatchRow>();
  let encSeq = 0;
  let batchSeq = 0;

  return {
    patient: {
      findUnique: jest.fn(async ({ where: { id } }: { where: { id: string } }) =>
        id === PATIENT.id ? PATIENT : null,
      ),
    },
    facility: {
      findUnique: jest.fn(async ({ where: { id } }: { where: { id: string } }) =>
        id === FACILITY.id ? FACILITY : null,
      ),
    },
    professional: {
      findUnique: jest.fn(async ({ where: { id } }: { where: { id: string } }) =>
        id === PROFESSIONAL.id ? PROFESSIONAL : null,
      ),
    },
    professionalAssignment: {
      findMany: jest.fn(async () => [ASSIGNMENT]),
    },
    dentalEncounter: {
      create: jest.fn(async ({ data }: { data: Partial<DentalRow> }) => {
        encSeq += 1;
        const now = new Date('2026-08-12T14:00:00.000Z');
        const row: DentalRow = {
          id: `d${encSeq}`,
          patientId: data.patientId!,
          facilityId: data.facilityId!,
          professionalId: data.professionalId ?? null,
          assignmentId: data.assignmentId ?? null,
          encounterType: data.encounterType || 'CONSULTA',
          status: data.status || 'IN_PROGRESS',
          anamnese: data.anamnese ?? null,
          proceduresJson: data.proceduresJson || '[]',
          odontogramJson: data.odontogramJson || '{}',
          outcomesJson: data.outcomesJson || '[]',
          careJson: data.careJson || '{}',
          startedAt: now,
          finishedAt: null,
          productionBatchId: null,
          createdAt: now,
          updatedAt: now,
        };
        encounters.set(row.id, row);
        return withIncludes(row);
      }),
      update: jest.fn(async ({ where: { id }, data }: { where: { id: string }; data: Partial<DentalRow> }) => {
        const prev = encounters.get(id);
        if (!prev) throw new Error(`dentalEncounter ${id} not found`);
        const clean = Object.fromEntries(
          Object.entries(data).filter(([, v]) => v !== undefined),
        ) as Partial<DentalRow>;
        const next: DentalRow = {
          ...prev,
          ...clean,
          updatedAt: new Date(),
        };
        encounters.set(id, next);
        return withIncludes(next);
      }),
      findUnique: jest.fn(async ({ where: { id } }: { where: { id: string } }) => {
        const row = encounters.get(id);
        return row ? withIncludes(row) : null;
      }),
      findMany: jest.fn(async (args?: EncounterQuery) =>
        filterEncounters(encounters, args).map(withIncludes),
      ),
      count: jest.fn(async (args?: EncounterQuery) => filterEncounters(encounters, args).length),
    },
    productionBatch: {
      create: jest.fn(async ({ data }: { data: Partial<BatchRow> }) => {
        batchSeq += 1;
        const row: BatchRow = {
          id: `b${batchSeq}`,
          kind: data.kind || 'dental_encounter',
          status: data.status || 'draft',
          rfIdsCsv: data.rfIdsCsv || '',
          payloadJson: data.payloadJson || '{}',
          errorMessage: data.errorMessage ?? null,
          statusChangedAt: data.statusChangedAt || new Date(),
        };
        batches.set(row.id, row);
        return row;
      }),
      update: jest.fn(async ({ where: { id }, data }: { where: { id: string }; data: Partial<BatchRow> }) => {
        const prev = batches.get(id);
        if (!prev) throw new Error(`productionBatch ${id} not found`);
        const clean = Object.fromEntries(
          Object.entries(data).filter(([, v]) => v !== undefined),
        ) as Partial<BatchRow>;
        const next = { ...prev, ...clean };
        batches.set(id, next);
        return next;
      }),
      findUnique: jest.fn(async ({ where: { id } }: { where: { id: string } }) =>
        batches.get(id) ?? null,
      ),
    },
    audit: jest.fn(async () => undefined),
  };
}

describe('fluxo odonto → faturamento-queue', () => {
  const prevIne = process.env.REQUIRE_INE_DENTAL_OPEN;

  beforeEach(() => {
    process.env.REQUIRE_INE_DENTAL_OPEN = 'true';
  });

  afterEach(() => {
    if (prevIne === undefined) delete process.env.REQUIRE_INE_DENTAL_OPEN;
    else process.env.REQUIRE_INE_DENTAL_OPEN = prevIne;
  });

  it('open → patch → finish → aparece na fila (com sync)', async () => {
    const prisma = createPrismaMemory();
    const service = new CareExtraService(prisma as never);

    const opened = await service.openDental({
      patientId: PATIENT.id,
      facilityId: FACILITY.id,
      professionalId: PROFESSIONAL.id,
      assignmentId: ASSIGNMENT.id,
      encounterType: 'CONSULTA',
    });
    expect(opened.id).toBeTruthy();
    expect(opened.status).toBe('IN_PROGRESS');
    expect(opened.productionBatchId).toBeTruthy();

    const patched = await service.patchDental(opened.id, {
      outcomes: ['ALTA'],
      vigilanciaSaudeBucal: [1],
      problemasCondicoes: [{ ciap: 'D82' }],
      procedures: [{ code: '0101020010', label: 'Consulta odonto', done: true }],
      tipoAtendimento: 5,
    });
    expect(patched.care.outcomes).toEqual(['ALTA']);
    expect(patched.care.vigilanciaSaudeBucal).toEqual([1]);

    const finished = await service.finishDental(opened.id, {
      outcomes: ['ALTA'],
      vigilanciaSaudeBucal: [1],
      problemasCondicoes: [{ ciap: 'D82' }],
    });
    expect(finished.encounter.status).toBe('COMPLETED');
    expect(finished.productionBatch.id).toBe(opened.productionBatchId);
    expect(finished.fao.summary.blockers).toBe(0);
    expect(finished.productionBatch.status).toBe('ready');

    const sync = await service.syncDentalBillingQueue(opened.id);
    expect(sync).toEqual(
      expect.objectContaining({
        productionBatchId: opened.productionBatchId,
        blockers: 0,
      }),
    );
    expect(sync?.bucket).toBe('ok');

    const competencia = competenciaFromDate(new Date('2026-08-12T14:00:00.000Z'));
    const queue = await service.listDentalFaturamentoQueue({ competencia });
    const item = queue.items.find((i) => i.encounterId === opened.id);
    expect(item).toBeTruthy();
    expect(item!.encounterStatus).toBe('COMPLETED');
    expect(item!.productionBatchId).toBe(opened.productionBatchId);
    expect(item!.batchStatus).toBe('ready');
    expect(item!.bucket).toBe('ok');
    expect(queue.totals.ok).toBeGreaterThanOrEqual(1);
    expect(queue.totals.ready).toBeGreaterThanOrEqual(1);
  });

  it('preview expõe Previne (eixo B) sem bloquear Siaps; VOID pós-COMPLETED retira da fila', async () => {
    const prisma = createPrismaMemory();
    const service = new CareExtraService(prisma as never);

    const opened = await service.openDental({
      patientId: PATIENT.id,
      facilityId: FACILITY.id,
      professionalId: PROFESSIONAL.id,
      assignmentId: ASSIGNMENT.id,
      encounterType: 'CONSULTA',
    });

    await service.patchDental(opened.id, {
      outcomes: ['ALTA'],
      vigilanciaSaudeBucal: [99],
      problemasCondicoes: [{ ciap: 'D82' }],
      procedures: [{ code: '0101020010', label: 'Consulta odonto', done: true }],
      tipoAtendimento: 5,
    });

    const preview = await service.previewDentalFao(opened.id);
    expect(preview.siapsReady).toBe(true);
    expect(preview.canFinish).toBe(true);
    expect(preview.vigilanciaOnly99).toBe(true);
    expect(preview.previne).toBeTruthy();
    expect(preview.previne?.gaps.some((g) => g.code === 'PREVINE_VIGILANCIA_99')).toBe(true);
    // Avisos Previne não viram BLOCKER Siaps
    expect(preview.fao.summary.blockers).toBe(0);

    const finished = await service.finishDental(opened.id, {
      outcomes: ['ALTA'],
      vigilanciaSaudeBucal: [99],
      problemasCondicoes: [{ ciap: 'D82' }],
    });
    expect(finished.encounter.status).toBe('COMPLETED');
    expect(finished.fao.summary.blockers).toBe(0);
    expect(finished.productionBatch.status).toBe('ready');

    const voided = await service.voidDental(opened.id, {
      reason: 'lançamento incorreto',
      acknowledgeLocalOnly: true,
    });
    expect(voided.status).toBe('VOID');
    expect(voided.voidMeta?.ministryRecall).toBe(false);
    expect(voided.voidMeta?.localOnly).toBe(true);

    const batch = await prisma.productionBatch.findUnique({
      where: { id: opened.productionBatchId! },
    });
    expect(batch?.status).toBe('error');
    expect(batch?.errorMessage).toMatch(/VOID local pós-COMPLETED/);

    const competencia = competenciaFromDate(new Date('2026-08-12T14:00:00.000Z'));
    const queue = await service.listDentalFaturamentoQueue({ competencia });
    expect(queue.items.find((i) => i.encounterId === opened.id)).toBeUndefined();
  });
});
