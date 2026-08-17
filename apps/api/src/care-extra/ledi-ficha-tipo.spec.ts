import {
  assertLoteTipoMatch,
  CDS_LOTE_STUB,
  detectLediFichaTipo,
  isLediTipoMismatchError,
  LediTipoMismatchError,
  LEDI_TIPO_MISMATCH,
  LOTE_TELA,
} from './ledi-ficha-tipo';

describe('ledi-ficha-tipo', () => {
  it('detecta FAO tipo 5', () => {
    const xml = `<ns3:dadoTransporteTransportXml>
<tipoDadoSerializado>5</tipoDadoSerializado>
<ns4:fichaAtendimentoOdontologicoMasterTransport></ns4:fichaAtendimentoOdontologicoMasterTransport>
</ns3:dadoTransporteTransportXml>`;
    const t = detectLediFichaTipo(xml);
    expect(t.id).toBe('FAO');
    expect(t.code).toBe(5);
    expect(t.odontoLoteSupported).toBe(true);
    expect(t.loteXmlLive).toBe(true);
  });

  it('detecta FAI tipo 4', () => {
    const xml = `<dadoTransporteTransportXml>
<tipoDadoSerializado>4</tipoDadoSerializado>
<fichaAtendimentoIndividualMasterTransport></fichaAtendimentoIndividualMasterTransport>
</dadoTransporteTransportXml>`;
    const t = detectLediFichaTipo(xml);
    expect(t.id).toBe('FAI');
    expect(t.code).toBe(4);
    expect(t.odontoLoteSupported).toBe(false);
    expect(t.loteXmlLive).toBe(true);
  });

  it('detecta Procedimentos tipo 7', () => {
    const xml = `<dadoTransporteTransportXml>
<tipoDadoSerializado>7</tipoDadoSerializado>
<fichaProcedimentoMasterTransport></fichaProcedimentoMasterTransport>
</dadoTransporteTransportXml>`;
    const t = detectLediFichaTipo(xml);
    expect(t.id).toBe('PROCEDIMENTOS');
    expect(t.code).toBe(7);
    expect(t.loteXmlLive).toBe(true);
  });

  it('detecta Cadastro Domiciliar tipo 3 (live)', () => {
    const xml = `<dadoTransporteTransportXml>
<tipoDadoSerializado>3</tipoDadoSerializado>
<cadastroDomiciliarTransport></cadastroDomiciliarTransport>
</dadoTransporteTransportXml>`;
    const t = detectLediFichaTipo(xml);
    expect(t.id).toBe('CADASTRO_DOMICILIAR');
    expect(t.code).toBe(3);
    expect(t.loteXmlLive).toBe(true);
    expect(t.masterTag).toBe('cadastroDomiciliarTransport');
  });

  it('detecta Visita ACS tipo 8 por tag (live)', () => {
    const xml = `<dadoTransporteTransportXml>
<fichaVisitaDomiciliarMasterTransport></fichaVisitaDomiciliarMasterTransport>
</dadoTransporteTransportXml>`;
    const t = detectLediFichaTipo(xml);
    expect(t.id).toBe('VISITA_ACS');
    expect(t.code).toBe(8);
    expect(t.loteXmlLive).toBe(true);
  });

  it('detecta AD tipo 10 (live)', () => {
    const xml = `<dadoTransporteTransportXml>
<tipoDadoSerializado>10</tipoDadoSerializado>
<fichaAtendimentoDomiciliarMasterTransport></fichaAtendimentoDomiciliarMasterTransport>
</dadoTransporteTransportXml>`;
    const t = detectLediFichaTipo(xml);
    expect(t.id).toBe('AD');
    expect(t.code).toBe(10);
    expect(t.loteXmlLive).toBe(true);
  });

  it('alinha vacina ao código 14 (não 2)', () => {
    const byCode = detectLediFichaTipo(
      `<dadoTransporteTransportXml><tipoDadoSerializado>14</tipoDadoSerializado></dadoTransporteTransportXml>`,
    );
    expect(byCode.id).toBe('VACINA');
    expect(byCode.code).toBe(14);
    expect(byCode.loteXmlLive).toBe(false);
    const byTag = detectLediFichaTipo(
      `<dadoTransporteTransportXml><fichaVacinacaoMasterTransport/></dadoTransporteTransportXml>`,
    );
    expect(byTag.id).toBe('VACINA');
    expect(byTag.code).toBe(14);
    const individual = detectLediFichaTipo(
      `<dadoTransporteTransportXml><tipoDadoSerializado>2</tipoDadoSerializado></dadoTransporteTransportXml>`,
    );
    expect(individual.id).toBe('CADASTRO_INDIVIDUAL');
    expect(individual.loteXmlLive).toBe(true);
  });
});

const FAO_XML = `<dadoTransporteTransportXml>
<tipoDadoSerializado>5</tipoDadoSerializado>
<fichaAtendimentoOdontologicoMasterTransport></fichaAtendimentoOdontologicoMasterTransport>
</dadoTransporteTransportXml>`;

const FAI_XML = `<dadoTransporteTransportXml>
<tipoDadoSerializado>4</tipoDadoSerializado>
<fichaAtendimentoIndividualMasterTransport></fichaAtendimentoIndividualMasterTransport>
</dadoTransporteTransportXml>`;

const PROC_XML = `<dadoTransporteTransportXml>
<tipoDadoSerializado>7</tipoDadoSerializado>
<fichaProcedimentoMasterTransport></fichaProcedimentoMasterTransport>
</dadoTransporteTransportXml>`;

const DOM_XML = `<dadoTransporteTransportXml>
<tipoDadoSerializado>3</tipoDadoSerializado>
<cadastroDomiciliarTransport></cadastroDomiciliarTransport>
</dadoTransporteTransportXml>`;

describe('assertLoteTipoMatch (gate P0)', () => {
  it('aceita lote homogêneo do tipo da tela', () => {
    expect(() =>
      assertLoteTipoMatch({ expectedTipo: 'FAI', files: [{ name: 'a.xml', xml: FAI_XML }] }),
    ).not.toThrow();
    expect(() =>
      assertLoteTipoMatch({ expectedTipo: 'FAO', files: [{ name: 'b.xml', xml: FAO_XML }] }),
    ).not.toThrow();
    expect(() =>
      assertLoteTipoMatch({
        expectedTipo: 'PROCEDIMENTOS',
        files: [{ name: 'c.xml', xml: PROC_XML }],
      }),
    ).not.toThrow();
    expect(() =>
      assertLoteTipoMatch({
        expectedTipo: 'CADASTRO_DOMICILIAR',
        files: [{ name: 'd.xml', xml: DOM_XML }],
      }),
    ).not.toThrow();
  });

  it('recusa FAO na tela FAI sem seguir análise', () => {
    expect(() =>
      assertLoteTipoMatch({ expectedTipo: 'FAI', files: [{ name: 'odonto.xml', xml: FAO_XML }] }),
    ).toThrow(LediTipoMismatchError);
    try {
      assertLoteTipoMatch({ expectedTipo: 'FAI', files: [{ name: 'odonto.xml', xml: FAO_XML }] });
    } catch (e) {
      expect(isLediTipoMismatchError(e)).toBe(true);
      const err = e as LediTipoMismatchError;
      expect(err.code).toBe(LEDI_TIPO_MISMATCH);
      expect(err.detectedTipo).toBe('FAO');
      expect(err.href).toBe('/faturamento/lote/fao');
      expect(err.message).toMatch(/Lote LEDI FAO/);
      expect(err.message).toMatch(/não analisamos/);
      expect(err.toHttpBody().statusCode).toBe(400);
    }
  });

  it('recusa o ZIP inteiro se qualquer ficha for de outro tipo (lote misto)', () => {
    expect(() =>
      assertLoteTipoMatch({
        expectedTipo: 'FAI',
        files: [
          { name: 'ok.xml', xml: FAI_XML },
          { name: 'errado.xml', xml: FAO_XML },
        ],
      }),
    ).toThrow(/errado\.xml/);
  });

  it('recusa FAI na tela FAO e PROC na tela FAI', () => {
    expect(() =>
      assertLoteTipoMatch({ expectedTipo: 'FAO', files: [{ name: 'x.xml', xml: FAI_XML }] }),
    ).toThrow(/Lote LEDI FAI/);
    expect(() =>
      assertLoteTipoMatch({ expectedTipo: 'FAI', files: [{ name: 'p.xml', xml: PROC_XML }] }),
    ).toThrow(/Lote Procedimentos/);
  });

  it('recusa CDS domicílio na tela FAI apontando wizard live', () => {
    try {
      assertLoteTipoMatch({ expectedTipo: 'FAI', files: [{ name: 'dom.xml', xml: DOM_XML }] });
      fail('expected throw');
    } catch (e) {
      const err = e as LediTipoMismatchError;
      expect(err.detectedTipo).toBe('CADASTRO_DOMICILIAR');
      expect(err.href).toBe(LOTE_TELA.CADASTRO_DOMICILIAR.href);
      expect(err.href).toBe(CDS_LOTE_STUB.CADASTRO_DOMICILIAR.href);
      expect(err.message).not.toMatch(/stub/);
    }
  });

  it('recusa visita ACS e AD nas telas live apontando rotas corretas', () => {
    const visita = `<dadoTransporteTransportXml>
<tipoDadoSerializado>8</tipoDadoSerializado>
<fichaVisitaDomiciliarMasterTransport></fichaVisitaDomiciliarMasterTransport>
</dadoTransporteTransportXml>`;
    const ad = `<dadoTransporteTransportXml>
<tipoDadoSerializado>10</tipoDadoSerializado>
<fichaAtendimentoDomiciliarMasterTransport></fichaAtendimentoDomiciliarMasterTransport>
</dadoTransporteTransportXml>`;
    try {
      assertLoteTipoMatch({ expectedTipo: 'FAO', files: [{ name: 'visita.xml', xml: visita }] });
      fail('expected throw');
    } catch (e) {
      const err = e as LediTipoMismatchError;
      expect(err.detectedTipo).toBe('VISITA_ACS');
      expect(err.href).toBe(LOTE_TELA.VISITA_ACS.href);
      expect(err.message).not.toMatch(/stub/);
    }
    try {
      assertLoteTipoMatch({ expectedTipo: 'PROCEDIMENTOS', files: [{ name: 'ad.xml', xml: ad }] });
      fail('expected throw');
    } catch (e) {
      const err = e as LediTipoMismatchError;
      expect(err.detectedTipo).toBe('AD');
      expect(err.href).toBe(LOTE_TELA.AD.href);
    }
  });
});
