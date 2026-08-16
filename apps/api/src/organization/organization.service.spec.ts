import { BadRequestException } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { applyGestaoFilter } from '../cnes/cnes.filter';
import { FRANCA_IBGE, loadBundledSnapshot } from '../cnes/cnes.snapshot';

describe('OrganizationService assignments', () => {
  it('rejeita CBO inválido', async () => {
    const prisma = {
      professional: { findUnique: jest.fn().mockResolvedValue({ id: 'pr1' }) },
      facility: { findUnique: jest.fn().mockResolvedValue({ id: 'f1' }) },
      professionalAssignment: { create: jest.fn() },
    };
    const service = new OrganizationService(prisma as never);
    await expect(
      service.createAssignment({
        professionalId: 'pr1',
        facilityId: 'f1',
        cbo: 'AB',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exige equipe da mesma unidade', async () => {
    const prisma = {
      professional: { findUnique: jest.fn().mockResolvedValue({ id: 'pr1' }) },
      facility: { findUnique: jest.fn().mockResolvedValue({ id: 'f1' }) },
      team: { findUnique: jest.fn().mockResolvedValue({ id: 't1', facilityId: 'f2' }) },
      professionalAssignment: { create: jest.fn() },
    };
    const service = new OrganizationService(prisma as never);
    await expect(
      service.createAssignment({
        professionalId: 'pr1',
        facilityId: 'f1',
        teamId: 't1',
        cbo: '225125',
      }),
    ).rejects.toThrow(/equipe não pertence/);
  });
});

describe('OrganizationService listFacilities escopo municipal', () => {
  it('default gestao=municipal filtra por rede Prefeitura (não cidade inteira)', async () => {
    const { snapshot } = loadBundledSnapshot(FRANCA_IBGE);
    const { snapshot: muni } = applyGestaoFilter(snapshot, 'municipal');
    expect(muni.establishments.length).toBe(66);

    const findMany = jest.fn().mockResolvedValue([]);
    const service = new OrganizationService({ facility: { findMany } } as never);
    await service.listFacilities(undefined, true, '3516200');

    const where = findMany.mock.calls[0][0].where;
    const and = where.AND as Array<Record<string, unknown>>;
    expect(and.some((c) => c.active === true)).toBe(true);
    expect(and.some((c) => c.ibgeCode === '3516200')).toBe(true);
    const scope = and.find((c) => c.OR) as { OR: Array<Record<string, unknown>> };
    expect(scope.OR.some((o) => o.municipalNetwork === true)).toBe(true);
    const cnesIn = scope.OR.find((o) => o.cnes && typeof o.cnes === 'object') as {
      cnes: { in: string[] };
    };
    expect(cnesIn.cnes.in).toHaveLength(66);
  });

  it('gestao=todos não aplica escopo Prefeitura', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new OrganizationService({ facility: { findMany } } as never);
    await service.listFacilities(undefined, true, '3516200', 'todos');
    const where = findMany.mock.calls[0][0].where;
    const and = where.AND as Array<Record<string, unknown>>;
    expect(and.every((c) => !c.OR && !c.municipalNetwork)).toBe(true);
  });

  it('cnpj=prefeitura alinha ao escopo mantenedora', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new OrganizationService({ facility: { findMany } } as never);
    await service.listFacilities(undefined, undefined, '3516200', 'todos', 'prefeitura');
    const where = findMany.mock.calls[0][0].where;
    const and = where.AND as Array<Record<string, unknown>>;
    expect(and.some((c) => c.OR)).toBe(true);
  });
});
