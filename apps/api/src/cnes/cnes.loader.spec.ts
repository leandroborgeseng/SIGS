import { loadCnesSnapshot } from './cnes.loader';
import type { CnesSnapshot } from './cnes.types';

describe('cnes.loader', () => {
  const snapshot: CnesSnapshot = {
    meta: { ibgeCode: '3516200', counts: { establishments: 1, teams: 1, establishmentsActive: 1 } },
    establishments: [
      {
        cnes: '9647198',
        name: 'UBS SANTA CLARA',
        typeId: '2',
        active: true,
        ibgeCode: '3516200',
        naturezaJuridica: '1244',
        municipalNetwork: true,
        address: { street: 'RUA A', number: '1', neighborhood: 'B', city: 'Franca', state: 'SP', zip: '14400000' },
      },
    ],
    teams: [
      {
        cnes: '9647198',
        ine: '0001667653',
        name: 'EQUIPE SANTA CLARA',
        teamTypeId: '70',
        active: true,
      },
    ],
  };

  it('cria facility e team na 1ª carga', async () => {
    const facility = {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'f1', cnes: '9647198' }),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    };
    const team = {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 't1' }),
      update: jest.fn(),
    };
    const out = await loadCnesSnapshot({ facility, team } as never, snapshot, {
      source: 'snapshot',
      gestao: 'municipal',
    });
    expect(out.facilities.created).toBe(1);
    expect(out.teams.created).toBe(1);
    expect(out.gestao).toBe('municipal');
    expect(out.filter.after.establishments).toBe(1);
    expect(facility.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          municipalNetwork: true,
          naturezaJuridica: '1244',
          cnpj: '47970769000104',
        }),
      }),
    );
    expect(facility.updateMany).toHaveBeenCalled();
    expect(team.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ine: '0001667653', facilityId: 'f1' }),
      }),
    );
  });

  it('é idempotente na 2ª carga sem mudanças', async () => {
    const existingFac = {
      id: 'f1',
      cnes: '9647198',
      name: 'UBS SANTA CLARA',
      active: true,
      cnpj: '47970769000104',
      typeId: '2',
      ibgeCode: '3516200',
      municipalNetwork: true,
      naturezaJuridica: '1244',
      addressStreet: 'RUA A',
      addressNumber: '1',
      addressNeighborhood: 'B',
      addressCity: 'Franca',
      addressState: 'SP',
      addressZip: '14400000',
    };
    const existingTeam = {
      id: 't1',
      facilityId: 'f1',
      name: 'EQUIPE SANTA CLARA',
      teamTypeId: '70',
      active: true,
      ine: '0001667653',
    };
    const facility = {
      findUnique: jest.fn().mockResolvedValue(existingFac),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    };
    const team = {
      findUnique: jest.fn().mockResolvedValue(existingTeam),
      create: jest.fn(),
      update: jest.fn(),
    };
    const out = await loadCnesSnapshot({ facility, team } as never, snapshot, { source: 'snapshot' });
    expect(out.facilities).toEqual({ created: 0, updated: 0, skipped: 1 });
    expect(out.teams).toEqual({ created: 0, updated: 0, skipped: 1 });
    expect(facility.update).not.toHaveBeenCalled();
    expect(team.update).not.toHaveBeenCalled();
  });
});
