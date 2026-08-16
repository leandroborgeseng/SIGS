import { listLediCdsLotes } from './ledi-cds-lote.stub';

describe('ledi-cds-lote.stub', () => {
  it('lista live 4/5/7 e stubs 3/8/10 sem misturar', () => {
    const cat = listLediCdsLotes();
    expect(cat.live.map((i) => i.code).sort((a, b) => a - b)).toEqual([4, 5, 7]);
    expect(cat.stubs.map((i) => i.code).sort((a, b) => a - b)).toEqual([3, 8, 10]);
    for (const s of cat.stubs) {
      expect(s.blocker).toBeTruthy();
      expect(s.loteXmlStatus).toBe('stub');
    }
    for (const l of cat.live) {
      expect(l.blocker).toBeNull();
      expect(l.loteXmlStatus).toBe('live');
    }
  });
});
