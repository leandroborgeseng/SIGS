import { validateFaiXml } from './ledi-fai.validator';
import { validateProcXml } from './ledi-proc.validator';
import { fixStNaoPossuiCpf } from './ledi-fao-xml.fixer';

const FAI_SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<ns3:dadoTransporteTransportXml xmlns:ns3="http://esus.ufsc.br/dadotransporte" xmlns:ns4="http://esus.ufsc.br/fichaatendimentoindividualmaster">
<tipoDadoSerializado>4</tipoDadoSerializado>
<cnesDadoSerializado>2035871</cnesDadoSerializado>
<ineDadoSerializado>0002321246</ineDadoSerializado>
<ns4:fichaAtendimentoIndividualMasterTransport>
<headerTransport>
<profissionalCNS>126090861660005</profissionalCNS>
<cboCodigo_2002>225125</cboCodigo_2002>
<cnes>2035871</cnes>
<ine>0002321246</ine>
<dataAtendimento>1786038654000</dataAtendimento>
<codigoIbgeMunicipio>3516200</codigoIbgeMunicipio>
</headerTransport>
<atendimentosIndividuais>
<cnsCidadao>703601040321538</cnsCidadao>
<dataNascimento>655009200000</dataNascimento>
<sexo>1</sexo>
<localDeAtendimento>1</localDeAtendimento>
<tipoAtendimento>2</tipoAtendimento>
<turno>2</turno>
<cid10>Z000</cid10>
</atendimentosIndividuais>
</ns4:fichaAtendimentoIndividualMasterTransport>
</ns3:dadoTransporteTransportXml>`;

const PROC_SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<ns3:dadoTransporteTransportXml xmlns:ns3="http://esus.ufsc.br/dadotransporte" xmlns:ns4="http://esus.ufsc.br/fichaprocedimentomaster">
<tipoDadoSerializado>7</tipoDadoSerializado>
<cnesDadoSerializado>2061589</cnesDadoSerializado>
<ineDadoSerializado>0001557882</ineDadoSerializado>
<ns4:fichaProcedimentoMasterTransport>
<headerTransport>
<profissionalCNS>170035710460009</profissionalCNS>
<cboCodigo_2002>225250</cboCodigo_2002>
<cnes>2061589</cnes>
<ine>0001557882</ine>
<dataAtendimento>1786100618000</dataAtendimento>
<codigoIbgeMunicipio>3516200</codigoIbgeMunicipio>
</headerTransport>
<atendProcedimentos>
<cnsCidadao>703601040321538</cnsCidadao>
<dtNascimento>655009200000</dtNascimento>
<sexo>1</sexo>
<localAtendimento>1</localAtendimento>
<turno>1</turno>
<procedimentos>0301100039</procedimentos>
</atendProcedimentos>
</ns4:fichaProcedimentoMasterTransport>
</ns3:dadoTransporteTransportXml>`;

describe('ledi-fai / ledi-proc validators', () => {
  it('FAI: marca ST_NAO_POSSUI_CPF e auto-fix remove', () => {
    const before = validateFaiXml(FAI_SAMPLE);
    expect(before.findings.some((f) => f.code === 'ST_NAO_POSSUI_CPF')).toBe(true);
    expect(before.siapsReady).toBe(false);

    const fixed = fixStNaoPossuiCpf(FAI_SAMPLE);
    expect(fixed.changed).toBe(true);
    const after = validateFaiXml(fixed.xml);
    expect(after.findings.some((f) => f.code === 'ST_NAO_POSSUI_CPF')).toBe(false);
    expect(after.siapsReady).toBe(true);
  });

  it('PROC: marca ST_NAO_POSSUI_CPF e rejeita ABPG', () => {
    const before = validateProcXml(PROC_SAMPLE);
    expect(before.findings.some((f) => f.code === 'ST_NAO_POSSUI_CPF')).toBe(true);

    const withAbpg = PROC_SAMPLE.replace('0301100039', 'ABPG028');
    const abpg = validateProcXml(withAbpg);
    expect(abpg.findings.some((f) => f.code === 'PROC_CODE_ABPG')).toBe(true);

    const fixed = fixStNaoPossuiCpf(PROC_SAMPLE);
    expect(fixed.changed).toBe(true);
    const after = validateProcXml(fixed.xml);
    expect(after.findings.some((f) => f.code === 'ST_NAO_POSSUI_CPF')).toBe(false);
  });
});
