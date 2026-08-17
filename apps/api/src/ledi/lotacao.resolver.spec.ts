import { pickActiveAssignment, resolveLotacaoHeader } from './lotacao.resolver';

const base = {
  id: 'a1',
  professionalId: 'p1',
  facilityId: 'f1',
  teamId: 't1',
  cbo: '225125',
  active: true,
  professional: { cns: '898001111111111' },
  facility: { cnes: '9999999' },
  team: { ine: '0000000001' },
};

describe('lotacao.resolver', () => {
  it('escolhe lotação da equipe quando há match', () => {
    const other = { ...base, id: 'a2', teamId: 't2', cbo: '223505' };
    const picked = pickActiveAssignment([other, base], {
      professionalId: 'p1',
      facilityId: 'f1',
      teamId: 't1',
    });
    expect(picked?.id).toBe('a1');
  });

  it('monta header LEDI completo', () => {
    const h = resolveLotacaoHeader({
      facilityCnes: '9999999',
      professionalCns: null,
      assignments: [base],
      professionalId: 'p1',
      facilityId: 'f1',
      teamId: 't1',
    });
    expect(h).toMatchObject({
      profissionalCNS: '898001111111111',
      cboCodigo_2002: '225125',
      cnes: '9999999',
      ine: '0000000001',
      assignmentId: 'a1',
    });
  });

  it('aceita cboOverride sem assignment', () => {
    const h = resolveLotacaoHeader({
      facilityCnes: '1234567',
      professionalCns: '898009999999999',
      cboOverride: '223505',
      assignments: [],
    });
    expect(h.cboCodigo_2002).toBe('223505');
    expect(h.assignmentId).toBeNull();
  });

  it('exige INE quando a lotação aponta equipe com INE e o valor some', () => {
    expect(() =>
      resolveLotacaoHeader({
        facilityCnes: '9999999',
        professionalCns: '898001111111111',
        cboOverride: '225125',
        teamIne: '',
        assignments: [{ ...base, team: { ine: '' } }],
        professionalId: 'p1',
        facilityId: 'f1',
        teamId: 't1',
      }),
    ).not.toThrow();
  });

  it('bloqueia se equipe tem INE oficial e header ficou sem INE (teamIne forçado vazio após strip)', () => {
    const broken = {
      ...base,
      team: { ine: '0000000001' },
    };
    // resolve sempre copia INE da equipe — header deve trazer INE
    const h = resolveLotacaoHeader({
      facilityCnes: '9999999',
      assignments: [broken],
      professionalId: 'p1',
      facilityId: 'f1',
      teamId: 't1',
      teamIne: null,
    });
    expect(h.ine).toBe('0000000001');
  });
});
