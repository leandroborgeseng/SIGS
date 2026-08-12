import {
  fixStNaoPossuiCpf,
  applyAutoFixes,
  fixProblemasCondicoes,
  addProcedimentos,
  addTiposEncamOdonto,
  fixTiposVigilanciaSaudeBucal,
} from './ledi-fao-xml.fixer';
import { validateFaoXml } from './ledi-fao.validator';

const SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<ns3:dadoTransporteTransportXml xmlns:ns3="http://esus.ufsc.br/dadotransporte" xmlns:ns4="http://esus.ufsc.br/fichaatendimentoodontologicomaster">
<uuidDadoSerializado>9647198-4F1FDA7E-B1D8-4496-AFB4-5ADCBC6389C7</uuidDadoSerializado>
<tipoDadoSerializado>5</tipoDadoSerializado>
<codIbge>3516200</codIbge>
<cnesDadoSerializado>9647198</cnesDadoSerializado>
<ineDadoSerializado>0002165929</ineDadoSerializado>
<numLote>006738044001</numLote>
<ns4:fichaAtendimentoOdontologicoMasterTransport>
<uuidFicha>9647198-4F1FDA7E-B1D8-4496-AFB4-5ADCBC6389C7</uuidFicha>
<tpCdsOrigem>3</tpCdsOrigem>
<atendimentosOdontologicos>
<cnsCidadao>703601040321538</cnsCidadao>
<dtNascimento>1001646000000</dtNascimento>
<localAtendimento>1</localAtendimento>
<gestante>false</gestante>
<tipoAtendimento>2</tipoAtendimento>
<tiposEncamOdonto>16</tiposEncamOdonto>
<tiposVigilanciaSaudeBucal>3</tiposVigilanciaSaudeBucal>
<tiposConsultaOdonto>1</tiposConsultaOdonto>
<procedimentosRealizados>
<coMsProcedimento>0301010030</coMsProcedimento>
<quantidade>1</quantidade>
</procedimentosRealizados>
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
<ine>0002165929</ine>
</lotacaoFormPrincipal>
<dataAtendimento>1786038654000</dataAtendimento>
<codigoIbgeMunicipio>3516200</codigoIbgeMunicipio>
</headerTransport>
</ns4:fichaAtendimentoOdontologicoMasterTransport>
</ns3:dadoTransporteTransportXml>`;

describe('ledi-fao-xml.fixer', () => {
  it('injeta stNaoPossuiCpf=false quando há CNS', () => {
    const before = validateFaoXml(SAMPLE);
    expect(before.findings.some((f) => f.code === 'ST_NAO_POSSUI_CPF')).toBe(true);

    const { xml, changed } = fixStNaoPossuiCpf(SAMPLE);
    expect(changed).toBe(true);
    expect(xml).toMatch(/<stNaoPossuiCpf>false<\/stNaoPossuiCpf>/);

    const after = validateFaoXml(xml);
    expect(after.findings.some((f) => f.code === 'ST_NAO_POSSUI_CPF')).toBe(false);
  });

  it('aplica auto-fix e problemasCondicoes', () => {
    const report = validateFaoXml(SAMPLE);
    const auto = applyAutoFixes(SAMPLE, report.findings, { stNaoPossuiCpf: true });
    expect(auto.applied).toContain('ST_NAO_POSSUI_CPF');

    const withProb = fixProblemasCondicoes(auto.xml, [{ ciap: 'D82' }]);
    expect(withProb.changed).toBe(true);
    const final = validateFaoXml(withProb.xml);
    expect(final.findings.some((f) => f.code === 'PROBLEMAS_MISSING')).toBe(false);
    expect(final.findings.some((f) => f.code === 'ST_NAO_POSSUI_CPF')).toBe(false);
  });

  it('acrescenta procedimento, conduta 15 e troca vigilância 99', () => {
    const with99 = SAMPLE.replace(
      '<tiposVigilanciaSaudeBucal>3</tiposVigilanciaSaudeBucal>',
      '<tiposVigilanciaSaudeBucal>99</tiposVigilanciaSaudeBucal>',
    );
    const proc = addProcedimentos(with99, [{ coMsProcedimento: '0301010153' }]);
    expect(proc.changed).toBe(true);
    expect(proc.xml).toMatch(/0301010153/);

    const enc = addTiposEncamOdonto(proc.xml, [15]);
    expect(enc.changed).toBe(true);
    expect(enc.xml).toMatch(/<tiposEncamOdonto>15<\/tiposEncamOdonto>/);

    const vig = fixTiposVigilanciaSaudeBucal(enc.xml, [1, 3]);
    expect(vig.changed).toBe(true);
    expect(vig.xml).toMatch(/<tiposVigilanciaSaudeBucal>1<\/tiposVigilanciaSaudeBucal>/);
    expect(vig.xml).not.toMatch(/<tiposVigilanciaSaudeBucal>99<\/tiposVigilanciaSaudeBucal>/);
  });
});
