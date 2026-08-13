import { BadRequestException } from '@nestjs/common';
import { EncountersService } from './encounters.service';
import { buildIndividualEncounterLediPayload } from './ledi-individual.mapper';
import { validateFaiJson } from '../care-extra/ledi-fai.validator';
import { LEDI_CONDUTA } from '../ledi/db-enums';

const FACILITY = { id: 'f1', cnes: '2035871', ibgeCode: '3516200', name: 'UBS Demo' };
const PATIENT = {
  id: 'p1',
  civilName: 'Paciente Demo',
  cpf: '39053344705',
  cns: '703601040321538',
  birthDate: new Date('1990-05-10'),
  sex: 'FEMALE',
};
const PROFESSIONAL = { id: 'pr1', civilName: 'Médico Demo', cns: '898001234567890' };
const ASSIGNMENT = {
  id: 'a1',
  professionalId: PROFESSIONAL.id,
  facilityId: FACILITY.id,
  cbo: '225125',
  active: true,
  professional: PROFESSIONAL,
  facility: FACILITY,
  team: { id: 't1', name: 'eSF', ine: '0002321246' },
};

describe('APS FAI tipo 4 — origem', () => {
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

  it('catálogo APS usa condutas FAI (não odonto)', () => {
    const service = new EncountersService({} as never);
    const cat = service.catalogAps();
    expect(cat.config.fichaTipo).toBe(4);
    expect(cat.condutas.map((c) => c.lediId).sort((a, b) => a - b)).toEqual(
      LEDI_CONDUTA.map((c) => c.id).sort((a, b) => a - b),
    );
    expect(cat.condutas.find((c) => c.id === 'ALTA')?.lediId).toBe(9);
    expect(cat.condutas.some((c) => c.id === 'TRATAMENTO_CONCLUIDO')).toBe(false);
    expect(cat.condutas).toHaveLength(LEDI_CONDUTA.length);
    expect(cat.tipoAtendimento.map((t) => t.id)).toEqual([1, 2, 4, 5, 6]);
    expect(cat.procedimentos.some((p) => p.code === '0301010064')).toBe(true);
  });

  it('payload FAI mínimo passa validateFaiJson (Siaps-ready)', () => {
    const payload = buildIndividualEncounterLediPayload({
      uuidFicha: 'ficha-ok',
      lotacao: {
        profissionalCNS: '898001234567890',
        cboCodigo_2002: '225125',
        cnes: '2035871',
        ine: '0002321246',
      },
      codigoIbgeMunicipio: '3516200',
      startedAt: new Date('2026-08-13T12:00:00Z'),
      finishedAt: new Date('2026-08-13T12:20:00Z'),
      patient: PATIENT,
      tipoAtendimento: 5,
      localAtendimento: 1,
      turno: 2,
      clinical: {
        faiOrigin: true,
        outcomes: ['ALTA'],
        problemasCondicoes: [{ ciap: 'K86' }],
        procedimentos: [{ code: '0301010064', label: 'Consulta médica', quantidade: 1 }],
        stNaoPossuiCpf: false,
      },
    });
    const report = validateFaiJson(payload as unknown as Record<string, unknown>);
    expect(report.findings.filter((f) => f.severity === 'BLOCKER')).toEqual([]);
    expect(report.siapsReady).toBe(true);
    expect(report.channel).toBe('LEDI_FAI_SIAPS');
  });

  it('validateFaiJson bloqueia sem conduta e sem CIAP/CID', () => {
    const payload = buildIndividualEncounterLediPayload({
      uuidFicha: 'ficha-bad',
      lotacao: {
        profissionalCNS: '898001234567890',
        cboCodigo_2002: '225125',
        cnes: '2035871',
        ine: '0002321246',
      },
      startedAt: new Date('2026-08-13T12:00:00Z'),
      patient: PATIENT,
      tipoAtendimento: 5,
      clinical: {
        outcomes: ['ALTA'],
        stNaoPossuiCpf: false,
      },
    });
    payload.atendimentosIndividuais[0].condutas = [];
    const report = validateFaiJson(payload as unknown as Record<string, unknown>);
    expect(report.siapsReady).toBe(false);
    expect(report.findings.some((f) => f.code === 'CONDUTA_MISSING')).toBe(true);
    expect(report.findings.some((f) => f.code === 'PROBLEMAS_MISSING')).toBe(true);
  });

  function makePrisma() {
    const created: Record<string, unknown>[] = [];
    const prisma = {
      patient: { findUnique: jest.fn().mockResolvedValue(PATIENT) },
      facility: { findUnique: jest.fn().mockResolvedValue(FACILITY) },
      professional: { findUnique: jest.fn().mockResolvedValue(PROFESSIONAL) },
      professionalAssignment: {
        findUnique: jest.fn().mockResolvedValue(ASSIGNMENT),
        findMany: jest.fn().mockResolvedValue([ASSIGNMENT]),
      },
      team: { findUnique: jest.fn().mockResolvedValue(ASSIGNMENT.team) },
      encounter: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockImplementation(async () => created[0] || null),
        create: jest.fn().mockImplementation(({ data }) => {
          const row = {
            id: 'e-fai',
            ...data,
            startedAt: new Date('2026-08-13T12:00:00.000Z'),
            finishedAt: null,
            productionBatchId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            patient: PATIENT,
            facility: FACILITY,
            professional: PROFESSIONAL,
          };
          created.push(row);
          return Promise.resolve(row);
        }),
        update: jest.fn().mockImplementation(({ data }) => {
          const next = { ...created[0], ...data, patient: PATIENT, facility: FACILITY, professional: PROFESSIONAL };
          created[0] = next;
          return Promise.resolve(next);
        }),
      },
      productionBatch: {
        create: jest.fn().mockResolvedValue({
          id: 'batch-1',
          kind: 'individual_encounter',
          status: 'draft',
        }),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'batch-1', kind: 'individual_encounter', ...data }),
        ),
      },
      appointmentSlot: { update: jest.fn() },
      audit: jest.fn(),
    };
    return { prisma, created };
  }

  it('abre FAI com lotação/INE e cria ProductionBatch', async () => {
    const { prisma } = makePrisma();
    const service = new EncountersService(prisma as never);
    const out = await service.open({
      patientId: PATIENT.id,
      facilityId: FACILITY.id,
      professionalId: PROFESSIONAL.id,
      assignmentId: ASSIGNMENT.id,
      faiOrigin: true,
    });
    expect(out.id).toBe('e-fai');
    expect(out.reused).toBe(false);
    if (!('care' in out)) throw new Error('esperado care na abertura FAI');
    expect(out.care.faiOrigin).toBe(true);
    expect(out.care.tipoAtendimento).toBe(5);
    expect(prisma.productionBatch.create).toHaveBeenCalled();
    expect(prisma.encounter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'IN_PROGRESS' }),
      }),
    );
  });

  it('abre FAI sem INE → 400 quando REQUIRE_INE_APS_OPEN', async () => {
    const { prisma } = makePrisma();
    prisma.professionalAssignment.findUnique = jest.fn().mockResolvedValue({
      ...ASSIGNMENT,
      team: { id: 't1', name: 'eSF', ine: null },
    });
    prisma.professionalAssignment.findMany = jest.fn().mockResolvedValue([
      { ...ASSIGNMENT, team: { id: 't1', name: 'eSF', ine: null } },
    ]);
    const service = new EncountersService(prisma as never);
    await expect(
      service.open({
        patientId: PATIENT.id,
        facilityId: FACILITY.id,
        assignmentId: ASSIGNMENT.id,
        faiOrigin: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('finish FAI atualiza ProductionBatch ready quando Siaps-ready', async () => {
    const { prisma, created } = makePrisma();
    const care = {
      faiOrigin: true,
      tipoAtendimento: 5,
      localAtendimento: 1,
      turno: 2,
      outcomes: ['ALTA'],
      problemasCondicoes: [{ ciap: 'K86', cid10: 'I10' }],
      procedimentos: [{ code: '0301010064', label: 'Consulta médica', quantidade: 1 }],
      stNaoPossuiCpf: false,
      assignmentId: ASSIGNMENT.id,
      cbo: '225125',
    };
    created.push({
      id: 'e-fai',
      patientId: PATIENT.id,
      facilityId: FACILITY.id,
      professionalId: PROFESSIONAL.id,
      teamId: 't1',
      status: 'IN_PROGRESS',
      startedAt: new Date('2026-08-13T12:00:00.000Z'),
      finishedAt: null,
      careLocation: 'UBS',
      shift: 'TARDE',
      encounterType: 'CONSULTA_NO_DIA',
      clinicalJson: JSON.stringify(care),
      productionBatchId: 'batch-1',
      appointmentId: null,
      patient: PATIENT,
      facility: FACILITY,
      professional: PROFESSIONAL,
    });
    const service = new EncountersService(prisma as never);
    const out = await service.finish('e-fai', { outcomes: ['ALTA'] });
    expect(out.productionBatch.status).toBe('ready');
    expect(out.productionBatch.kind).toBe('individual_encounter');
    expect(prisma.productionBatch.update).toHaveBeenCalled();
    expect(prisma.encounter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
  });
});
