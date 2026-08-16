import { loadCnesProfessionalsSnapshot } from './cnes.professionals.loader';
import { parseCnesWebProfessionalsHtml } from './cnes.professionals.snapshot';
import type { CnesProfessionalsSnapshot } from './cnes.professionals.types';

describe('parseCnesWebProfessionalsHtml', () => {
  it('extrai nome CNS CBO atividade', () => {
    const html = `
      <tr bgcolor='#cccccc'>
        <td><font size=1>VANESSA PEREIRA SILVA</font></td>
        <td align=center><font size=1>704000884861063</font></td>
        <td align=center><font size=1>223505</font></td>
        <td align=center><font size=1>ENFERMEIRO</font></td>
      </tr>
    `;
    const rows = parseCnesWebProfessionalsHtml(html);
    expect(rows).toEqual([
      {
        civilName: 'VANESSA PEREIRA SILVA',
        cns: '704000884861063',
        cbo: '223505',
        roleLabel: 'ENFERMEIRO',
      },
    ]);
  });
});

describe('loadCnesProfessionalsSnapshot', () => {
  const snapshot: CnesProfessionalsSnapshot = {
    meta: { ibgeCode: '3516200', counts: { professionals: 1, assignments: 1 } },
    professionals: [{ cns: '704000884861063', civilName: 'VANESSA PEREIRA SILVA' }],
    assignments: [
      {
        cns: '704000884861063',
        cnes: '9647198',
        ine: '0001667653',
        cbo: '223505',
        roleLabel: 'ENFERMEIRO',
        active: true,
      },
    ],
  };

  it('cria profissional e lotação', async () => {
    const professional = {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'p1', cns: '704000884861063' }),
      update: jest.fn(),
    };
    const facility = {
      findMany: jest.fn().mockResolvedValue([{ id: 'f1', cnes: '9647198' }]),
    };
    const team = {
      findMany: jest.fn().mockResolvedValue([{ id: 't1', ine: '0001667653', facilityId: 'f1' }]),
    };
    const professionalAssignment = {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'a1' }),
      update: jest.fn(),
    };
    const out = await loadCnesProfessionalsSnapshot(
      { professional, facility, team, professionalAssignment } as never,
      snapshot,
      { source: 'snapshot' },
    );
    expect(out.professionals.created).toBe(1);
    expect(out.assignments.created).toBe(1);
    expect(professionalAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          professionalId: 'p1',
          facilityId: 'f1',
          teamId: 't1',
          cbo: '223505',
        }),
      }),
    );
  });

  it('pula lotação se facility ainda não sincronizada', async () => {
    const professional = {
      findFirst: jest.fn().mockResolvedValue({ id: 'p1', cns: '704000884861063', civilName: 'X' }),
      create: jest.fn(),
      update: jest.fn(),
    };
    const facility = { findMany: jest.fn().mockResolvedValue([]) };
    const team = { findMany: jest.fn().mockResolvedValue([]) };
    const professionalAssignment = {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    const out = await loadCnesProfessionalsSnapshot(
      { professional, facility, team, professionalAssignment } as never,
      snapshot,
      { source: 'snapshot' },
    );
    expect(out.professionals.updated).toBe(1);
    expect(out.assignments.skipped).toBe(1);
    expect(professionalAssignment.create).not.toHaveBeenCalled();
  });
});
