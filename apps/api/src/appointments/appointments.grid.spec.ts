import { buildDayGrid, clampSlotMinutes } from './appointments.grid';

describe('buildDayGrid', () => {
  const from = new Date('2026-08-13T10:00:00.000Z');
  const to = new Date('2026-08-13T12:00:00.000Z');

  it('gera faixas de 30 min e coloca o slot na faixa do início', () => {
    const grid = buildDayGrid({
      from,
      to,
      slotMinutes: 30,
      slots: [
        {
          id: 's1',
          professionalId: 'pr1',
          startsAt: '2026-08-13T10:10:00.000Z',
          endsAt: '2026-08-13T10:40:00.000Z',
          status: 'SCHEDULED',
          itemType: 'CONSULTA',
          professional: { id: 'pr1', civilName: 'Ana' },
        },
        {
          id: 's2',
          professionalId: 'pr2',
          startsAt: '2026-08-13T11:00:00.000Z',
          endsAt: '2026-08-13T11:20:00.000Z',
          status: 'SCHEDULED',
          itemType: 'ENCAIXE',
          professional: { id: 'pr2', civilName: 'Bruno' },
        },
      ],
    });

    expect(grid.slotMinutes).toBe(30);
    expect(grid.bands).toHaveLength(4);
    expect(grid.professionals.map((p) => p.civilName)).toEqual(['Ana', 'Bruno']);
    expect(grid.bands[0].cells.pr1?.[0].id).toBe('s1');
    expect(grid.bands[0].cells.pr2).toBeUndefined();
    expect(grid.bands[2].cells.pr2?.[0].itemType).toBe('ENCAIXE');
  });

  it('intervalo invertido devolve grade vazia', () => {
    const grid = buildDayGrid({
      from: to,
      to: from,
      slots: [],
    });
    expect(grid.bands).toEqual([]);
  });
});

describe('clampSlotMinutes', () => {
  it('limita 15–60 e default 30', () => {
    expect(clampSlotMinutes(undefined)).toBe(30);
    expect(clampSlotMinutes(5)).toBe(15);
    expect(clampSlotMinutes(90)).toBe(60);
    expect(clampSlotMinutes(20)).toBe(20);
  });
});
