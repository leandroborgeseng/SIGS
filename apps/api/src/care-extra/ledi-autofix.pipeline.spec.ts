import { runAutoFixPipeline, FRANCA_LEDI_DEFAULTS } from './ledi-autofix.pipeline';
import { validateFaoXml } from './ledi-fao.validator';

const SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<ns3:dadoTransporteTransportXml xmlns:ns3="http://esus.ufsc.br/dadotransporte" xmlns:ns4="http://esus.ufsc.br/fichaatendimentoodontologicomaster">
<tipoDadoSerializado>5</tipoDadoSerializado>
<cnesDadoSerializado>9647198</cnesDadoSerializado>
<ineDadoSerializado></ineDadoSerializado>
<ns4:fichaAtendimentoOdontologicoMasterTransport>
<uuidFicha>9647198-4F1FDA7E-B1D8-4496-AFB4-5ADCBC6389C7</uuidFicha>
<tpCdsOrigem>1</tpCdsOrigem>
<atendimentosOdontologicos>
<cnsCidadao>703601040321538</cnsCidadao>
<dtNascimento>1001646000000</dtNascimento>
<localAtendimento>1</localAtendimento>
<gestante>false</gestante>
<tipoAtendimento>2</tipoAtendimento>
<tiposEncamOdonto>16</tiposEncamOdonto>
<tiposVigilanciaSaudeBucal>3</tiposVigilanciaSaudeBucal>
<tiposConsultaOdonto>1</tiposConsultaOdonto>
<procedimentosRealizados><coMsProcedimento>0301010030</coMsProcedimento><quantidade>1</quantidade></procedimentosRealizados>
<problemasCondicoes><ciap>D82</ciap></problemasCondicoes>
<turno>2</turno>
<sexo>1</sexo>
<dataHoraInicialAtendimento>1786038654000</dataHoraInicialAtendimento>
<dataHoraFinalAtendimento>1786041482000</dataHoraFinalAtendimento>
</atendimentosOdontologicos>
<headerTransport>
<lotacaoFormPrincipal>
<profissionalCNS>126090861660005</profissionalCNS>
<cboCodigo_2002>223208</cboCodigo_2002>
<cnes>9647198</cnes>
<ine></ine>
</lotacaoFormPrincipal>
<dataAtendimento>1786038654000</dataAtendimento>
<codigoIbgeMunicipio>3516200</codigoIbgeMunicipio>
</headerTransport>
</ns4:fichaAtendimentoOdontologicoMasterTransport>
</ns3:dadoTransporteTransportXml>`;

describe('ledi-autofix.pipeline (P4)', () => {
  it('dry-run mental: pipeline remove ST + TP_CDS + INE', () => {
    const before = validateFaoXml(SAMPLE);
    expect(before.findings.some((f) => f.code === 'ST_NAO_POSSUI_CPF')).toBe(true);
    expect(before.findings.some((f) => f.code === 'TP_CDS_ORIGEM_NOT_3')).toBe(true);

    const r = runAutoFixPipeline(SAMPLE, before.findings, {
      stNaoPossuiCpf: true,
      ine: '0002165929',
    });
    expect(r.changed).toBe(true);
    expect(r.applied.length).toBeGreaterThan(0);

    const after = validateFaoXml(r.xml);
    expect(after.findings.some((f) => f.code === 'ST_NAO_POSSUI_CPF')).toBe(false);
    expect(after.findings.some((f) => f.code === 'TP_CDS_ORIGEM_NOT_3')).toBe(false);
    expect(after.findings.some((f) => f.code === 'INE_MISSING')).toBe(false);
  });

  it('idempotente: segunda aplicação não muda', () => {
    const before = validateFaoXml(SAMPLE);
    const a = runAutoFixPipeline(SAMPLE, before.findings, { stNaoPossuiCpf: true, ine: '0002165929' });
    const mid = validateFaoXml(a.xml);
    const b = runAutoFixPipeline(a.xml, mid.findings, { stNaoPossuiCpf: true, ine: '0002165929' });
    expect(b.changed).toBe(false);
    expect(b.xml).toBe(a.xml);
  });

  it('defaults Franca disponíveis', () => {
    expect(FRANCA_LEDI_DEFAULTS.municipioIbge).toBe('3516200');
  });
});
