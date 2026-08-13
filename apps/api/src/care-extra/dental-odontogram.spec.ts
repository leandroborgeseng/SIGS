import {
  isValidFdiTooth,
  isValidOdontogramKey,
  isValidOdontogramScope,
  normalizeOdontogram,
  odontogramCatalog,
  odontogramHasDeciduous,
  odontogramMarkedCount,
  odontogramSnapshotApplyBlocker,
  ODONTOGRAM_HISTORY_LIMIT,
  ODONTOGRAM_SNAPSHOT_APPLY_MESSAGES,
  procedurePlacementFromKey,
  selectDoneProceduresFromSnapshot,
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
    expect(odontogramHasDeciduous(map)).toBe(false);
    expect(odontogramHasDeciduous({ '85': 'C' })).toBe(true);
    expect(ODONTOGRAM_HISTORY_LIMIT).toBe(50);
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
    expect(cat.note).toMatch(/RF-12\.13/);
    expect(cat.note).toMatch(/RF-12\.11/);
    expect(cat.note).toMatch(/odontogram-history\/:sourceId/);
  });

  it('autoriza copiar snapshot do mesmo paciente e unidade em IN_PROGRESS', () => {
    const target = {
      id: 'curr',
      patientId: 'p1',
      facilityId: 'f1',
      status: 'IN_PROGRESS',
      startedAt: new Date('2026-08-13T12:00:00.000Z'),
    };
    const source = {
      id: 'prev1',
      patientId: 'p1',
      facilityId: 'f1',
      status: 'COMPLETED',
      startedAt: new Date('2026-08-01T10:00:00.000Z'),
    };
    expect(odontogramSnapshotApplyBlocker(target, source)).toBeNull();
  });

  it('bloqueia VOID/COMPLETED no alvo, outro paciente/unidade e origem VOID', () => {
    const target = {
      id: 'curr',
      patientId: 'p1',
      facilityId: 'f1',
      status: 'IN_PROGRESS',
      startedAt: new Date('2026-08-13T12:00:00.000Z'),
    };
    const source = {
      id: 'prev1',
      patientId: 'p1',
      facilityId: 'f1',
      status: 'COMPLETED',
      startedAt: new Date('2026-08-01T10:00:00.000Z'),
    };
    expect(odontogramSnapshotApplyBlocker({ ...target, status: 'VOID' }, source)).toBe(
      'TARGET_NOT_EDITABLE',
    );
    expect(odontogramSnapshotApplyBlocker({ ...target, status: 'COMPLETED' }, source)).toBe(
      'TARGET_NOT_EDITABLE',
    );
    expect(odontogramSnapshotApplyBlocker(target, { ...source, status: 'VOID' })).toBe('SOURCE_VOID');
    expect(odontogramSnapshotApplyBlocker(target, { ...source, patientId: 'p2' })).toBe(
      'DIFFERENT_PATIENT',
    );
    expect(odontogramSnapshotApplyBlocker(target, { ...source, facilityId: 'f2' })).toBe(
      'DIFFERENT_FACILITY',
    );
    expect(odontogramSnapshotApplyBlocker(target, { ...source, id: 'curr' })).toBe('SELF');
    expect(odontogramSnapshotApplyBlocker(target, null)).toBe('SOURCE_NOT_FOUND');
    expect(
      odontogramSnapshotApplyBlocker(target, {
        ...source,
        startedAt: new Date('2026-08-14T00:00:00.000Z'),
      }),
    ).toBe('SOURCE_NOT_PRIOR');
    expect(ODONTOGRAM_SNAPSHOT_APPLY_MESSAGES.TARGET_NOT_EDITABLE).toMatch(/VOID\/COMPLETED/);
  });

  it('seleciona só procedimentos done do snapshot (omitido = realizado)', () => {
    expect(
      selectDoneProceduresFromSnapshot([
        { code: '0101020066', label: 'Selante', tooth: '11', done: true },
        { code: '0414020138', label: 'Exodontia', tooth: '28', done: false },
        { code: '0101020010', label: 'Consulta' },
      ]),
    ).toEqual([
      { code: '0101020066', label: 'Selante', tooth: '11', done: true },
      { code: '0101020010', label: 'Consulta' },
    ]);
    expect(selectDoneProceduresFromSnapshot('nope')).toEqual([]);
  });
});
