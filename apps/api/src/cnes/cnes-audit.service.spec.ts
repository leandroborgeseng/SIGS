import {
  isValidCnesFormat,
  normalizeCnes,
  teamFacilityTypeMismatch,
  loadBundledSnapshot,
  FRANCA_IBGE,
} from './cnes.snapshot';
import { CnesAuditService } from './cnes-audit.service';

describe('cnes.snapshot helpers', () => {
  it('valida CNES 7 dígitos', () => {
    expect(isValidCnesFormat('9647198')).toBe(true);
    expect(isValidCnesFormat('20876691')).toBe(false); // 8 dígitos — rejeição LEDI clássica
    expect(isValidCnesFormat('12')).toBe(false);
    expect(normalizeCnes('9647198')).toBe('9647198');
    expect(isValidCnesFormat('abc')).toBe(false);
  });

  it('heurística tipo equipe × tipo unidade', () => {
    expect(teamFacilityTypeMismatch('70', '22')).toBe(true);
    expect(teamFacilityTypeMismatch('70', '2')).toBe(false);
    expect(teamFacilityTypeMismatch('99', '22')).toBe(false);
  });

  it('carrega snapshot Franca versionado', () => {
    const { snapshot, path } = loadBundledSnapshot(FRANCA_IBGE);
    expect(path).toMatch(/franca-3516200\.json$/);
    expect(snapshot.meta.ibgeCode).toBe('3516200');
    expect(snapshot.establishments.length).toBeGreaterThan(100);
    expect(snapshot.teams.length).toBeGreaterThan(50);
  });
});

describe('CnesAuditService', () => {
  it('detecta CNES inválido, IBGE errado, facility sem equipe e INE duplicado', async () => {
    const facilities = [
      {
        id: 'f-bad',
        cnes: '12',
        name: 'Ruim',
        active: true,
        ibgeCode: '3516200',
        typeId: '2',
        _count: { teams: 0 },
      },
      {
        id: 'f-other',
        cnes: '1234567',
        name: 'Outro mun',
        active: true,
        ibgeCode: '3550308',
        typeId: '2',
        _count: { teams: 1 },
      },
      {
        id: 'f-ok',
        cnes: '9647198',
        name: 'UBS',
        active: true,
        ibgeCode: '3516200',
        typeId: '22',
        _count: { teams: 2 },
      },
    ];
    const teams = [
      {
        id: 't1',
        ine: '0001667653',
        teamTypeId: '70',
        active: true,
        facilityId: 'f-ok',
        facility: facilities[2],
      },
      {
        id: 't2',
        ine: '0001667653',
        teamTypeId: '70',
        active: true,
        facilityId: 'f-ok',
        facility: facilities[2],
      },
    ];
    const prisma = {
      facility: { findMany: jest.fn().mockResolvedValue(facilities) },
      team: { findMany: jest.fn().mockResolvedValue(teams) },
      patientTeamLink: { findMany: jest.fn().mockResolvedValue([]) },
      professionalAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      productionRecord: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new CnesAuditService(prisma as never);
    const report = await service.audit({ ibgeCode: '3516200', includeLedi: false });
    const codes = new Set(report.findings.map((f) => f.code));
    expect(codes.has('CNES_FORMAT_INVALID')).toBe(true);
    expect(codes.has('FACILITY_IBGE_MISMATCH')).toBe(true);
    expect(codes.has('FACILITY_WITHOUT_TEAM')).toBe(true);
    expect(codes.has('INE_DUPLICATE')).toBe(true);
    expect(codes.has('TEAM_FACILITY_TYPE_MISMATCH')).toBe(true);
    expect(report.counts.findings).toBeGreaterThan(0);
    expect(report.heuristics.teamFacilityType).toMatch(/consultório isolado/);
  });

  it('marca vínculo ativo em equipe inativa como órfão', async () => {
    const prisma = {
      facility: { findMany: jest.fn().mockResolvedValue([]) },
      team: { findMany: jest.fn().mockResolvedValue([]) },
      patientTeamLink: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'l1',
            teamId: 't-dead',
            patientId: 'p1',
            active: true,
            team: { id: 't-dead', active: false, ine: '0000000001' },
          },
        ]),
      },
      professionalAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      productionRecord: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new CnesAuditService(prisma as never);
    const report = await service.audit({ ibgeCode: '3516200', includeLedi: false });
    expect(report.findings.some((f) => f.code === 'PATIENT_TEAM_LINK_ORPHAN')).toBe(true);
  });
});
