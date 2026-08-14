import {
  assertLoteTipoMatch,
  detectLediFichaTipo,
  isLediTipoMismatchError,
  LediTipoMismatchError,
  LEDI_TIPO_MISMATCH,
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
  });

  it('detecta Procedimentos tipo 7', () => {
    const xml = `<dadoTransporteTransportXml>
<tipoDadoSerializado>7</tipoDadoSerializado>
<fichaProcedimentoMasterTransport></fichaProcedimentoMasterTransport>
</dadoTransporteTransportXml>`;
    const t = detectLediFichaTipo(xml);
    expect(t.id).toBe('PROCEDIMENTOS');
    expect(t.code).toBe(7);
    expect(t.odontoLoteSupported).toBe(false);
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
});
