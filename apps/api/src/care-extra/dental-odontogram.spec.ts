import {
  isValidFdiTooth,
  isValidOdontogramKey,
  isValidOdontogramScope,
  normalizeOdontogram,
  odontogramCatalog,
  odontogramMarkedCount,
  procedurePlacementFromKey,
  selectionKeyFromProcedure,
} from './dental-odontogram';

describe('dental-odontogram', () => {
  it('aceita FDI permanente e decídua', () => {
    expect(isValidFdiTooth('11')).toBe(true);
    expect(isValidFdiTooth('85')).toBe(true);
    expect(isValidFdiTooth('99')).toBe(false);
    expect(isValidFdiTooth('')).toBe(false);
  });

  it('aceita escopos quadrante, sextante e boca', () => {
    expect(isValidOdontogramScope('Q1')).toBe(true);
    expect(isValidOdontogramScope('s6')).toBe(true);
    expect(isValidOdontogramScope('BOCA')).toBe(true);
    expect(isValidOdontogramScope('Q5')).toBe(false);
    expect(isValidOdontogramKey('11')).toBe(true);
    expect(isValidOdontogramKey('Q2')).toBe(true);
    expect(isValidOdontogramKey('XX')).toBe(false);
  });

  it('normaliza códigos e omite vazios (dente + escopo)', () => {
    const map = normalizeOdontogram({
      '11': 'c',
      '21': 'R',
      '22': '',
      q1: 'S',
      S3: 'o',
      boca: 'P',
    });
    expect(map).toEqual({
      '11': 'C',
      '21': 'R',
      Q1: 'S',
      S3: 'O',
      BOCA: 'P',
    });
    expect(odontogramMarkedCount(map)).toBe(5);
  });

  it('rejeita chave ou condição inválidos', () => {
    expect(() => normalizeOdontogram({ '99': 'C' })).toThrow(/chave inválida/);
    expect(() => normalizeOdontogram({ Q9: 'C' })).toThrow(/chave inválida/);
    expect(() => normalizeOdontogram({ '11': 'ZZ' })).toThrow(/condição inválida/);
    expect(() => normalizeOdontogram([])).toThrow(/objeto/);
  });

  it('mapeia seleção → tooth ou region do procedimento', () => {
    expect(procedurePlacementFromKey('26')).toEqual({ tooth: '26' });
    expect(procedurePlacementFromKey('q2')).toEqual({ region: 'Q2' });
    expect(procedurePlacementFromKey('S5')).toEqual({ region: 'S5' });
    expect(procedurePlacementFromKey('boca')).toEqual({ region: 'BOCA' });
    expect(procedurePlacementFromKey('')).toEqual({});
    expect(selectionKeyFromProcedure({ tooth: '11' })).toBe('11');
    expect(selectionKeyFromProcedure({ region: 's1' })).toBe('S1');
    expect(selectionKeyFromProcedure({ region: 'BOCA' })).toBe('BOCA');
  });

  it('expõe catálogo com escopos para UI', () => {
    const cat = odontogramCatalog();
    expect(cat.conditions.some((c) => c.code === 'C')).toBe(true);
    expect(cat.arches.upperPermanent).toHaveLength(16);
    expect(cat.arches.lowerPermanent).toHaveLength(16);
    expect(cat.scopes.quadrants).toHaveLength(4);
    expect(cat.scopes.sextants).toHaveLength(6);
    expect(cat.scopes.mouth.code).toBe('BOCA');
    expect(cat.note).toMatch(/quadrante/i);
  });
});
