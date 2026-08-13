import {
  isValidFdiTooth,
  normalizeOdontogram,
  odontogramCatalog,
  odontogramMarkedCount,
} from './dental-odontogram';

describe('dental-odontogram', () => {
  it('aceita FDI permanente e decídua', () => {
    expect(isValidFdiTooth('11')).toBe(true);
    expect(isValidFdiTooth('85')).toBe(true);
    expect(isValidFdiTooth('99')).toBe(false);
    expect(isValidFdiTooth('')).toBe(false);
  });

  it('normaliza códigos e omite vazios', () => {
    const map = normalizeOdontogram({ '11': 'c', '21': 'R', '22': '' });
    expect(map).toEqual({ '11': 'C', '21': 'R' });
    expect(odontogramMarkedCount(map)).toBe(2);
  });

  it('rejeita dente ou condição inválidos', () => {
    expect(() => normalizeOdontogram({ '99': 'C' })).toThrow(/dente inválido/);
    expect(() => normalizeOdontogram({ '11': 'ZZ' })).toThrow(/condição inválida/);
    expect(() => normalizeOdontogram([])).toThrow(/objeto/);
  });

  it('expõe catálogo para UI', () => {
    const cat = odontogramCatalog();
    expect(cat.conditions.some((c) => c.code === 'C')).toBe(true);
    expect(cat.arches.upperPermanent).toHaveLength(16);
    expect(cat.arches.lowerPermanent).toHaveLength(16);
  });
});
