import { resolveTeamTypeLabel, listKnownTeamTypes, CNES_TEAM_TYPE_LABELS } from './team-type-catalog';

describe('team-type-catalog', () => {
  it('resolve tipo 76 como EAP', () => {
    expect(resolveTeamTypeLabel('76')).toMatch(/EAP/i);
    expect(resolveTeamTypeLabel('76')).toMatch(/Atenção Primária/i);
  });

  it('cobre tipos presentes no snapshot Franca', () => {
    for (const id of ['22', '23', '70', '71', '72', '73', '74', '76']) {
      expect(CNES_TEAM_TYPE_LABELS[id]).toBeTruthy();
      expect(resolveTeamTypeLabel(id)).not.toMatch(/sem catálogo/);
    }
  });

  it('fallback legível para código desconhecido', () => {
    expect(resolveTeamTypeLabel('99')).toBe('Tipo 99 (sem catálogo)');
    expect(resolveTeamTypeLabel('')).toBe('Tipo não informado');
    expect(resolveTeamTypeLabel(null)).toBe('Tipo não informado');
  });

  it('lista catálogo ordenado', () => {
    const list = listKnownTeamTypes();
    expect(list.some((t) => t.id === '76')).toBe(true);
    expect(list[0].id <= list[list.length - 1].id).toBe(true);
  });
});
