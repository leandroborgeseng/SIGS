import { NotFoundException } from '@nestjs/common';
import { CnesTeamsService } from './cnes-teams.service';
import { applyGestaoFilter } from './cnes.filter';
import { FRANCA_IBGE, loadBundledSnapshot } from './cnes.snapshot';

describe('CnesTeamsService', () => {
  it('lista equipes com label de tipo e contagem de membros', async () => {
    const { snapshot } = loadBundledSnapshot(FRANCA_IBGE);
    const { snapshot: muni } = applyGestaoFilter(snapshot, 'municipal');
    expect(muni.establishments.length).toBe(66);

    const findMany = jest.fn().mockResolvedValue([
      {
        id: 't1',
        name: 'EAP Centro',
        ine: '0001111111',
        teamTypeId: '76',
        active: true,
        facility: {
          id: 'f1',
          name: 'UBS Centro',
          cnes: '9647198',
          municipalNetwork: true,
        },
        _count: { assignments: 3 },
      },
      {
        id: 't2',
        name: 'ESF Norte',
        ine: '0002222222',
        teamTypeId: '70',
        active: true,
        facility: {
          id: 'f2',
          name: 'UBS Norte',
          cnes: '2087669',
          municipalNetwork: true,
        },
        _count: { assignments: 0 },
      },
    ]);

    const service = new CnesTeamsService({ team: { findMany } } as never);
    const out = await service.listTeams({ ibge: '3516200', gestao: 'municipal', activeOnly: true });

    expect(out.gestao).toBe('municipal');
    expect(out.counts.teams).toBe(2);
    expect(out.counts.withMembers).toBe(1);
    expect(out.teams[0].teamTypeLabel).toMatch(/EAP/i);
    expect(out.teams[0].memberCount).toBe(3);
    expect(out.teams[0].hasMembers).toBe(true);
    expect(out.teams[1].teamTypeLabel).toMatch(/ESF/i);
    expect(out.teams[1].hasMembers).toBe(false);

    const where = findMany.mock.calls[0][0].where;
    expect(where.AND).toBeDefined();
  });

  it('detalhe inclui membros com CBO label', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 't1',
      name: 'EAP Centro',
      ine: '0001111111',
      teamTypeId: '76',
      active: true,
      facility: {
        id: 'f1',
        name: 'UBS Centro',
        cnes: '9647198',
        municipalNetwork: true,
      },
      assignments: [
        {
          id: 'a1',
          cbo: '223505',
          roleLabel: 'ENFERMEIRO',
          active: true,
          startedAt: new Date('2024-01-01T00:00:00.000Z'),
          professional: {
            id: 'p1',
            civilName: 'Ana Silva',
            socialName: null,
            cns: '898001234567890',
          },
        },
      ],
    });
    const service = new CnesTeamsService({ team: { findUnique } } as never);
    const detail = await service.getTeam('t1');
    expect(detail.teamTypeLabel).toMatch(/EAP/i);
    expect(detail.members).toHaveLength(1);
    expect(detail.members[0].cboLabel).toBe('ENFERMEIRO');
    expect(detail.members[0].name).toBe('Ana Silva');
  });

  it('404 se equipe inexistente', async () => {
    const service = new CnesTeamsService({
      team: { findUnique: jest.fn().mockResolvedValue(null) },
    } as never);
    await expect(service.getTeam('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('multi-team agrupa profissionais com >1 equipe', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        professionalId: 'p1',
        cbo: '225125',
        roleLabel: 'MEDICO',
        teamId: 't1',
        professional: { id: 'p1', civilName: 'João', socialName: null, cns: '1' },
        team: {
          id: 't1',
          name: 'EAP A',
          ine: '1',
          teamTypeId: '76',
          facility: { name: 'UBS A', cnes: '111' },
        },
      },
      {
        professionalId: 'p1',
        cbo: '225125',
        roleLabel: 'MEDICO',
        teamId: 't2',
        professional: { id: 'p1', civilName: 'João', socialName: null, cns: '1' },
        team: {
          id: 't2',
          name: 'ESF B',
          ine: '2',
          teamTypeId: '70',
          facility: { name: 'UBS B', cnes: '222' },
        },
      },
      {
        professionalId: 'p2',
        cbo: '223505',
        roleLabel: 'ENFERMEIRO',
        teamId: 't1',
        professional: { id: 'p2', civilName: 'Maria', socialName: null, cns: '2' },
        team: {
          id: 't1',
          name: 'EAP A',
          ine: '1',
          teamTypeId: '76',
          facility: { name: 'UBS A', cnes: '111' },
        },
      },
    ]);
    const service = new CnesTeamsService({
      professionalAssignment: { findMany },
    } as never);
    const out = await service.listMultiTeamProfessionals({ ibge: '3516200' });
    expect(out.counts.professionals).toBe(1);
    expect(out.professionals[0].name).toBe('João');
    expect(out.professionals[0].teamCount).toBe(2);
    expect(out.professionals[0].teams[0].teamTypeLabel).toBeTruthy();
  });

  it('export network gera CSV com cabeçalho e linha sem membro', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        name: 'EAP Centro',
        ine: '0001',
        teamTypeId: '76',
        facility: { name: 'UBS', cnes: '9647198' },
        assignments: [],
      },
    ]);
    const service = new CnesTeamsService({ team: { findMany } } as never);
    const out = await service.exportNetwork({ ibge: '3516200' });
    expect(out.filename).toMatch(/cnes-rede-3516200/);
    expect(out.rowCount).toBe(1);
    expect(out.csv.split('\n')[0]).toContain('team_type_label');
    expect(out.csv).toContain('EAP');
    expect(out.csv).toContain('9647198');
  });
});
