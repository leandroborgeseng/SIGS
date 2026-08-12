import {
  bucketFromFindings,
  competenciaFromDate,
  competenciaRange,
  dentalMissingChecklist,
} from './dental-billing-queue';
import { defaultDentalCareDraft } from './dental-care.draft';

describe('dental-billing-queue', () => {
  it('competencia range UTC', () => {
    const { start, end } = competenciaRange('2026-08');
    expect(competenciaFromDate(start)).toBe('2026-08');
    expect(end.getUTCMonth()).toBe(8); // Sep 1 exclusive
  });

  it('checklist marca lacunas A', () => {
    const care = defaultDentalCareDraft();
    const miss = dentalMissingChecklist({
      care,
      patient: { cpf: null, cns: null, birthDate: null, sex: null },
      hasIne: false,
      requireIne: true,
      proceduresCount: 0,
    });
    const codes = miss.map((m) => m.code);
    expect(codes).toContain('PATIENT_ID_MISSING');
    expect(codes).toContain('CONDUTA_MISSING');
    expect(codes).toContain('VIGILANCIA_MISSING');
    expect(codes).toContain('PROBLEMAS_MISSING');
    expect(codes).toContain('INE_MISSING');
  });

  it('bucket prioriza blocker', () => {
    expect(
      bucketFromFindings(
        [{ severity: 'BLOCKER', code: 'X', message: 'm' }],
        true,
      ),
    ).toBe('blocker');
    expect(bucketFromFindings([], true)).toBe('incomplete');
    expect(bucketFromFindings([], false)).toBe('ok');
  });
});
