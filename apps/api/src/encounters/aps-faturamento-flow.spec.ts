/**
 * Fluxo mínimo API: open FAI → clinical → finish APS → aparece na faturamento-queue (+ sync).
 * Prisma mock em memória (sem DB real).
 */
import { EncountersService } from './encounters.service';
import { competenciaFromDate } from '../care-extra/dental-billing-queue';
import { APS_FATURAMENTO_QUEUE_LIMIT } from './aps-billing-queue';

const PATIENT = {
  id: 'p1',
  civilName: 'Paciente Demo',
  socialName: null as string | null,
  cpf: '39053344705',
  cns: '703601040321538',
  birthDate: new Date('1990-05-10'),
  sex: 'FEMALE',
};

const FACILITY = {
  id: 'f1',
  cnes: '2035871',
  ibgeCode: '3516200',
  name: 'UBS Demo',
};

const PROFESSIONAL = { id: 'pr1', civilName: 'Médico Demo', cns: '898001234567890' };

const ASSIGNMENT = {
  id: 'a1',
  professionalId: PROFESSIONAL.id,
  facilityId: FACILITY.id,
  teamId: 't1',
  cbo: '225125',
  active: true,
  professional: PROFESSIONAL,
  facility: FACILITY,
  team: { id: 't1', name: 'eSF', ine: '0002321246' },
};

type EncounterRow = {
  id: string;
  patientId: string;
  facilityId: string;
  professionalId: string | null;
  teamId: string | null;
  appointmentId: string | null;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  careLocation: string | null;
  shift: string | null;
  encounterType: string | null;
  lateRegistration: boolean;
  clinicalJson: string;
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

function withIncludes(row: EncounterRow) {
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
    clinicalJson?: { contains: string };
  };
  take?: number;
  select?: { id: true };
};

function filterEncounters(encounters: Map<string, EncounterRow>, args?: EncounterQuery): EncounterRow[] {
  let rows = [...encounters.values()];
  const w = args?.where;
  if (w?.id?.in) rows = rows.filter((r) => w.id!.in.includes(r.id));
  if (w?.status?.in) rows = rows.filter((r) => w.status!.in.includes(r.status));
  if (w?.facilityId) rows = rows.filter((r) => r.facilityId === w.facilityId);
  if (w?.startedAt) {
    rows = rows.filter((r) => r.startedAt >= w.startedAt!.gte && r.startedAt < w.startedAt!.lt);
  }
  if (w?.clinicalJson?.contains) {
    rows = rows.filter((r) => r.clinicalJson.includes(w.clinicalJson!.contains));
  }
  rows.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  if (args?.take != null) rows = rows.slice(0, args.take);
  return rows;
}

function createPrismaMemory() {
  const encounters = new Map<string, EncounterRow>();
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
      findUnique: jest.fn(async () => ASSIGNMENT),
    },
    team: {
      findUnique: jest.fn(async () => ASSIGNMENT.team),
    },
    appointmentSlot: { update: jest.fn() },
    encounter: {
      findFirst: jest.fn(async () => null),
      create: jest.fn(async ({ data }: { data: Partial<EncounterRow> }) => {
        encSeq += 1;
        const now = new Date('2026-08-13T12:00:00.000Z');
        const row: EncounterRow = {
          id: `e${encSeq}`,
          patientId: data.patientId!,
          facilityId: data.facilityId!,
          professionalId: data.professionalId ?? null,
          teamId: data.teamId ?? ASSIGNMENT.team.id,
          appointmentId: data.appointmentId ?? null,
          status: data.status || 'IN_PROGRESS',
          startedAt: now,
          finishedAt: null,
          careLocation: data.careLocation ?? 'UBS',
          shift: data.shift ?? 'TARDE',
          encounterType: data.encounterType ?? 'CONSULTA_NO_DIA',
          lateRegistration: data.lateRegistration ?? false,
          clinicalJson: data.clinicalJson || '{}',
          productionBatchId: null,
          createdAt: now,
          updatedAt: now,
        };
        encounters.set(row.id, row);
        return withIncludes(row);
      }),
      update: jest.fn(
        async ({ where: { id }, data }: { where: { id: string }; data: Partial<EncounterRow> }) => {
          const prev = encounters.get(id);
          if (!prev) throw new Error(`encounter ${id} not found`);
          const clean = Object.fromEntries(
            Object.entries(data).filter(([, v]) => v !== undefined),
          ) as Partial<EncounterRow>;
          const next: EncounterRow = { ...prev, ...clean, updatedAt: new Date() };
          encounters.set(id, next);
          return withIncludes(next);
        },
      ),
      findUnique: jest.fn(async ({ where: { id } }: { where: { id: string } }) => {
        const row = encounters.get(id);
        return row ? withIncludes(row) : null;
      }),
      findMany: jest.fn(async (args?: EncounterQuery) => {
        const rows = filterEncounters(encounters, args);
        if (args?.select?.id) return rows.map((r) => ({ id: r.id }));
        return rows.map(withIncludes);
      }),
      count: jest.fn(async (args?: EncounterQuery) => filterEncounters(encounters, args).length),
    },
    productionBatch: {
      create: jest.fn(async ({ data }: { data: Partial<BatchRow> }) => {
        batchSeq += 1;
        const row: BatchRow = {
          id: `b${batchSeq}`,
          kind: data.kind || 'individual_encounter',
          status: data.status || 'draft',
          rfIdsCsv: data.rfIdsCsv || '',
          payloadJson: data.payloadJson || '{}',
          errorMessage: data.errorMessage ?? null,
          statusChangedAt: data.statusChangedAt || new Date(),
        };
        batches.set(row.id, row);
        return row;
      }),
      update: jest.fn(
        async ({ where: { id }, data }: { where: { id: string }; data: Partial<BatchRow> }) => {
          const prev = batches.get(id);
          if (!prev) throw new Error(`productionBatch ${id} not found`);
          const clean = Object.fromEntries(
            Object.entries(data).filter(([, v]) => v !== undefined),
          ) as Partial<BatchRow>;
          const next = { ...prev, ...clean };
          batches.set(id, next);
          return next;
        },
      ),
      findUnique: jest.fn(async ({ where: { id } }: { where: { id: string } }) =>
        batches.get(id) ?? null,
      ),
    },
    audit: jest.fn(async () => undefined),
  };
}

describe('fluxo APS FAI → faturamento-queue', () => {
  const prevAps = process.env.REQUIRE_INE_APS_OPEN;
  const prevDental = process.env.REQUIRE_INE_DENTAL_OPEN;

  beforeEach(() => {
    process.env.REQUIRE_INE_APS_OPEN = 'true';
  });

  afterEach(() => {
    if (prevAps === undefined) delete process.env.REQUIRE_INE_APS_OPEN;
    else process.env.REQUIRE_INE_APS_OPEN = prevAps;
    if (prevDental === undefined) delete process.env.REQUIRE_INE_DENTAL_OPEN;
    else process.env.REQUIRE_INE_DENTAL_OPEN = prevDental;
  });

  it('open → clinical → finish → aparece na fila (com sync)', async () => {
    const prisma = createPrismaMemory();
    const service = new EncountersService(prisma as never);

    const opened = await service.open({
      patientId: PATIENT.id,
      facilityId: FACILITY.id,
      professionalId: PROFESSIONAL.id,
      assignmentId: ASSIGNMENT.id,
      faiOrigin: true,
    });
    expect(opened.id).toBeTruthy();
    if (!('care' in opened)) throw new Error('esperado care na abertura FAI');
    expect(opened.status).toBe('IN_PROGRESS');
    expect(opened.productionBatchId).toBeTruthy();
    expect(opened.care.faiOrigin).toBe(true);

    await service.saveClinical(opened.id, {
      outcomes: ['ALTA'],
      problemasCondicoes: [{ ciap: 'K86' }],
      procedimentos: [{ code: '0301010064', label: 'Consulta médica', quantidade: 1 }],
    });

    const finished = await service.finish(opened.id, { outcomes: ['ALTA'] });
    expect(finished.encounter.status).toBe('COMPLETED');
    expect(finished.productionBatch.id).toBe(opened.productionBatchId);
    expect(finished.productionBatch.kind).toBe('individual_encounter');
    expect(finished.productionBatch.status).toBe('ready');

    const sync = await service.syncApsBillingQueue(opened.id);
    expect(sync).toEqual(
      expect.objectContaining({
        productionBatchId: opened.productionBatchId,
        blockers: 0,
      }),
    );
    expect(sync?.bucket).toBe('ok');

    const competencia = competenciaFromDate(new Date('2026-08-13T12:00:00.000Z'));
    const queue = await service.listApsFaturamentoQueue({ competencia });
    const item = queue.items.find((i) => i.encounterId === opened.id);
    expect(item).toBeTruthy();
    expect(item!.encounterStatus).toBe('COMPLETED');
    expect(item!.productionBatchId).toBe(opened.productionBatchId);
    expect(item!.batchStatus).toBe('ready');
    expect(item!.bucket).toBe('ok');
    expect(item!.href).toBe(`/aps/${opened.id}`);
    expect(queue.totals.ok).toBeGreaterThanOrEqual(1);
    expect(queue.totals.ready).toBeGreaterThanOrEqual(1);
  });

  it('sync em lote percorre encounters FAI da competência', async () => {
    const prisma = createPrismaMemory();
    const service = new EncountersService(prisma as never);
    const opened = await service.open({
      patientId: PATIENT.id,
      facilityId: FACILITY.id,
      professionalId: PROFESSIONAL.id,
      assignmentId: ASSIGNMENT.id,
      faiOrigin: true,
    });
    const out = await service.syncApsFaturamentoQueueBatch({ competencia: '2026-08' });
    expect(out.total).toBe(1);
    expect(out.synced).toBe(1);
    expect(out.failed).toBe(0);
    expect(out.limit).toBe(APS_FATURAMENTO_QUEUE_LIMIT);
    expect(out.results[0].encounterId).toBe(opened.id);
  });
});
