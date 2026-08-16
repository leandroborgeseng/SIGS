import { CDS_LOTE_STUB } from '../care-extra/ledi-ficha-tipo';
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

  it('alinha hrefs/tags dos stubs com CDS_LOTE_STUB (gate FAI/FAO/PROC)', () => {
    const cat = listLediCdsLotes();
    const byId = Object.fromEntries(cat.stubs.map((s) => [s.id, s]));
    expect(byId.CADASTRO_DOMICILIAR.href).toBe(CDS_LOTE_STUB.CADASTRO_DOMICILIAR.href);
    expect(byId.VISITA_ACS.href).toBe(CDS_LOTE_STUB.VISITA_ACS.href);
    expect(byId.AD.href).toBe(CDS_LOTE_STUB.AD.href);
    expect(byId.CADASTRO_DOMICILIAR.masterTag).toBe('cadastroDomiciliarTransport');
    expect(byId.VISITA_ACS.masterTag).toBe('fichaVisitaDomiciliarMasterTransport');
    expect(byId.AD.masterTag).toBe('fichaAtendimentoDomiciliarMasterTransport');
    expect(byId.CADASTRO_DOMICILIAR.nativeHref).toBe('/territorio');
    expect(byId.AD.nativeHref).toBe('/ad');
  });
});
