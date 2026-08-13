import { buildDentalLediPayload } from './ledi-dental.mapper';
import {
  applyCatalogProcedure,
  lookupPredefinedProcedure,
  normalizeDentalProcedures,
  predefinedDentalCatalog,
  procedureFitsScope,
  realizadosForLedi,
  scopeFromSelectionKey,
  toggleProcedureDone,
} from './dental-predefined-procedures';

const lotacao = {
  profissionalCNS: '898001111111111',
  cboCodigo_2002: '223208',
  cnes: '9999999',
  ine: '0000000001',
};

describe('RF-12.13 procedimentos predefinidos no odontograma', () => {
  it('expõe catálogo com SIGTAP 10 dígitos e escopos', () => {
    const cat = predefinedDentalCatalog();
    expect(cat.procedures.length).toBeGreaterThanOrEqual(12);
    expect(cat.procedures.every((p) => /^\d{10}$/.test(p.code))).toBe(true);
    expect(cat.procedures.some((p) => p.code === '0301010153' && p.previne === 'B1')).toBe(true);
    expect(cat.procedures.some((p) => p.code === '0414020138' && p.scopes.includes('tooth'))).toBe(
      true,
    );
    expect(cat.note).toMatch(/RF-12\.13/);
  });

  it('aplica selante no dente e consulta sem dente', () => {
    const selante = applyCatalogProcedure('0101020066', '26', { done: true });
    expect(selante).toEqual({
      tooth: '26',
      code: '0101020066',
      label: 'Selante de fóssulas e fissuras',
      done: true,
    });
    const consulta = applyCatalogProcedure('0301010153', '11');
    expect(consulta.tooth).toBeUndefined();
    expect(consulta.region).toBeUndefined();
    expect(consulta.done).toBe(false);
    expect(consulta.code).toBe('0301010153');
  });

  it('aplica higiene em BOCA e flúor em sextante', () => {
    expect(applyCatalogProcedure('0101020104', 'boca').region).toBe('BOCA');
    expect(applyCatalogProcedure('0101020074', 'S2').region).toBe('S2');
  });

  it('rejeita escopo incompatível', () => {
    expect(() => applyCatalogProcedure('0307010031', 'Q1')).toThrow(/não se aplica/);
    expect(() => applyCatalogProcedure('0307010031')).toThrow(/não se aplica/);
    expect(() => applyCatalogProcedure('9999999999', '11')).toThrow(/desconhecido/);
  });

  it('classifica seleção e filtra catálogo', () => {
    expect(scopeFromSelectionKey('85')).toBe('tooth');
    expect(scopeFromSelectionKey('q3')).toBe('quadrant');
    expect(scopeFromSelectionKey('S6')).toBe('sextant');
    expect(scopeFromSelectionKey('BOCA')).toBe('mouth');
    const resto = lookupPredefinedProcedure('0307010031')!;
    expect(procedureFitsScope(resto, 'tooth')).toBe(true);
    expect(procedureFitsScope(resto, 'mouth')).toBe(false);
  });

  it('normaliza, deduplica e marca concluído', () => {
    const list = normalizeDentalProcedures([
      { code: '01.01.02.006-6', label: 'Selante', tooth: '11', done: false },
      { code: '0101020066', label: 'Selante', tooth: '11', done: true },
      { code: '0101020010', label: 'Consulta' },
    ]);
    expect(list).toHaveLength(2);
    const selante = list.find((p) => p.code === '0101020066')!;
    expect(selante.done).toBe(true);
    expect(selante.tooth).toBe('11');
    const toggled = toggleProcedureDone(list, { code: '0101020066', tooth: '11' }, false);
    expect(toggled.find((p) => p.code === '0101020066')?.done).toBe(false);
  });

  it('rejeita SIGTAP inválido ou dente inválido', () => {
    expect(() => normalizeDentalProcedures([{ code: 'ABPG1', label: 'x' }])).toThrow(/SIGTAP/);
    expect(() =>
      normalizeDentalProcedures([{ code: '0101020066', label: 's', tooth: '99' }]),
    ).toThrow(/FDI/);
  });

  it('LEDI só exporta realizados (done !== false)', () => {
    const procedures = normalizeDentalProcedures([
      { code: '0101020066', label: 'Selante', tooth: '16', done: false },
      { code: '0414020138', label: 'Exodontia', tooth: '28', done: true },
      { code: '0101020010', label: 'Consulta' },
    ]);
    const realizados = realizadosForLedi(procedures);
    expect(realizados.map((p) => p.code).sort()).toEqual(['0101020010', '0414020138']);

    const payload = buildDentalLediPayload({
      uuidFicha: 'd-13',
      lotacao,
      startedAt: new Date('2026-08-13T10:00:00Z'),
      finishedAt: new Date('2026-08-13T10:30:00Z'),
      patient: {
        cpf: '52998224725',
        cns: null,
        birthDate: new Date('1990-01-01'),
        sex: 'F',
      },
      outcomes: ['ALTA'],
      vigilanciaSaudeBucal: [1],
      problemasCondicoes: [{ ciap: 'D82' }],
      procedures: realizados,
    });
    const codes = payload.atendimentosOdontologicos[0].procedimentosRealizados.map(
      (p) => p.coMsProcedimento,
    );
    expect(codes).toEqual(['0414020138', '0101020010']);
    expect(payload.atendimentosOdontologicos[0].procedimentosRealizados[0].tooth).toBe('28');
  });
});
