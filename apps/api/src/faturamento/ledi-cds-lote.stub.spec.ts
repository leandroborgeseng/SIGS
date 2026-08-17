import { LOTE_TELA } from '../care-extra/ledi-ficha-tipo';
import { listLediCdsLotes } from './ledi-cds-lote.stub';

describe('ledi-cds-lote catalog', () => {
  it('lista live 2/3/4/5/6/7/8/10 e stub vacina 14', () => {
    const cat = listLediCdsLotes();
    expect(cat.live.map((i) => i.code).sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6, 7, 8, 10]);
    expect(cat.stubs.map((i) => i.code)).toEqual([14]);
    for (const l of cat.live) {
      expect(l.blocker).toBeNull();
      expect(l.loteXmlStatus).toBe('live');
      expect(l.href).toBeTruthy();
    }
    expect(cat.stubs[0]?.blocker).toBeTruthy();
  });

  it('alinha hrefs com LOTE_TELA', () => {
    const cat = listLediCdsLotes();
    const byId = Object.fromEntries(cat.items.map((s) => [s.id, s]));
    expect(byId.CADASTRO_DOMICILIAR.href).toBe(LOTE_TELA.CADASTRO_DOMICILIAR.href);
    expect(byId.VISITA_ACS.href).toBe(LOTE_TELA.VISITA_ACS.href);
    expect(byId.AD.href).toBe(LOTE_TELA.AD.href);
    expect(byId.COLETIVO.href).toBe(LOTE_TELA.COLETIVO.href);
    expect(byId.CADASTRO_INDIVIDUAL.href).toBe(LOTE_TELA.CADASTRO_INDIVIDUAL.href);
    expect(byId.CADASTRO_INDIVIDUAL.syntheticSchema).toBe(true);
    expect(byId.FAI.syntheticSchema).toBeFalsy();
  });
});
