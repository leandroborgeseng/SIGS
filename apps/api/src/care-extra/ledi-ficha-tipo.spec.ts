import { detectLediFichaTipo } from './ledi-ficha-tipo';

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
