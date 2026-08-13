import { SIGTAP_BPA_STUB_CODES, SIGTAP_SEED, sigtapSeedByTag } from './seed';

describe('SIGTAP seed expandido', () => {
  it('tem códigos usados no BPA stub', () => {
    const codes = new Set(SIGTAP_SEED.map((s) => s.code));
    for (const c of SIGTAP_BPA_STUB_CODES) {
      expect(codes.has(c)).toBe(true);
    }
  });

  it('tem cobertura piloto APS (enfermagem, odonto, regulação)', () => {
    const codes = new Set(SIGTAP_SEED.map((s) => s.code));
    expect(codes.has('0301010072')).toBe(true);
    expect(codes.has('0301040079')).toBe(true);
    expect(codes.has('0101020029')).toBe(true);
    expect(codes.has('0301010153')).toBe(true);
    expect(codes.has('0414020138')).toBe(true);
    expect(codes.has('0301010110')).toBe(true);
    expect(SIGTAP_SEED.length).toBeGreaterThanOrEqual(20);
  });

  it('filtra por tag', () => {
    expect(sigtapSeedByTag('bpa').length).toBe(SIGTAP_BPA_STUB_CODES.length);
    expect(sigtapSeedByTag('odonto').length).toBeGreaterThan(1);
  });

  it('códigos têm 10 dígitos', () => {
    for (const s of SIGTAP_SEED) {
      expect(s.code).toMatch(/^\d{10}$/);
    }
  });
});
