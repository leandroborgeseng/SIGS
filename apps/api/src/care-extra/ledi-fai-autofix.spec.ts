import { validateFaiXml } from './ledi-fai.validator';
import { runAutoFixPipeline } from './ledi-autofix.pipeline';
import {
  applyFaiAutoFixes,
  FAI_AUTO_FIXABLE_CODES,
  FAI_SUGGEST_ONLY_CODES,
  fixCiapFormat,
  fixCidFormat,
  fixCitizenIdDigits,
  fixCondutasFai,
  fixUuidFichaCase,
  fixXmlEncoding,
} from './ledi-fai-xml.fixer';
import { classifyAutoFixable } from './ledi-fao-xml.fixer';
import { AUTO_FIXABLE_CODES } from './ledi-fao-xml.fixer';
import { autoFixableCodes } from './ledi-error-registry';

const CNS_OK = '703601040321538';

function faiXml(inner: {
  encoding?: string;
  uuid?: string;
  tp?: string;
  cnes?: string;
  ine?: string;
  ibge?: string;
  dataAt?: string;
  child?: string;
}): string {
  const enc = inner.encoding ?? 'utf-8';
  const uuid = inner.uuid ?? '2035871-4F1FDA7E-B1D8-4496-AFB4-5ADCBC6389C7';
  const tp = inner.tp ?? '3';
  const cnes = inner.cnes ?? '2035871';
  const ine = inner.ine ?? '0002321246';
  const ibge = inner.ibge ?? '3516200';
  const dataAt = inner.dataAt ?? '1786038654000';
  const child =
    inner.child ??
    `<cnsCidadao>${CNS_OK}</cnsCidadao>
<dataNascimento>655009200000</dataNascimento>
<sexo>1</sexo>
<localDeAtendimento>1</localDeAtendimento>
<tipoAtendimento>2</tipoAtendimento>
<turno>2</turno>
<cid10>Z000</cid10>
<condutas>1</condutas>
<stNaoPossuiCpf>false</stNaoPossuiCpf>`;
  return `<?xml version="1.0" encoding="${enc}"?>
<ns3:dadoTransporteTransportXml xmlns:ns3="http://esus.ufsc.br/dadotransporte" xmlns:ns4="http://esus.ufsc.br/fichaatendimentoindividualmaster">
<tipoDadoSerializado>4</tipoDadoSerializado>
<cnesDadoSerializado>${cnes}</cnesDadoSerializado>
<ineDadoSerializado>${ine}</ineDadoSerializado>
<ns4:fichaAtendimentoIndividualMasterTransport>
<uuidFicha>${uuid}</uuidFicha>
<tpCdsOrigem>${tp}</tpCdsOrigem>
<headerTransport>
<profissionalCNS>${CNS_OK}</profissionalCNS>
<cboCodigo_2002>225125</cboCodigo_2002>
<cnes>${cnes}</cnes>
<ine>${ine}</ine>
<dataAtendimento>${dataAt}</dataAtendimento>
<codigoIbgeMunicipio>${ibge}</codigoIbgeMunicipio>
</headerTransport>
<atendimentosIndividuais>
${child}
</atendimentosIndividuais>
</ns4:fichaAtendimentoIndividualMasterTransport>
</ns3:dadoTransporteTransportXml>`;
}

describe('ledi-fai autofix (códigos de reparo)', () => {
  it('ST_NAO_POSSUI_CPF auto', () => {
    const xml = faiXml({
      child: `<cnsCidadao>${CNS_OK}</cnsCidadao>
<dataNascimento>655009200000</dataNascimento>
<sexo>1</sexo>
<localDeAtendimento>1</localDeAtendimento>
<tipoAtendimento>2</tipoAtendimento>
<turno>2</turno>
<cid10>Z000</cid10>
<condutas>1</condutas>`,
    });
    const before = validateFaiXml(xml);
    expect(before.findings.some((f) => f.code === 'ST_NAO_POSSUI_CPF')).toBe(true);
    const r = applyFaiAutoFixes(xml, before.findings);
    expect(r.applied).toContain('ST_NAO_POSSUI_CPF');
    expect(validateFaiXml(r.xml).findings.some((f) => f.code === 'ST_NAO_POSSUI_CPF')).toBe(false);
  });

  it('TURNO 0 → default 2', () => {
    const xml = faiXml({
      child: `<cnsCidadao>${CNS_OK}</cnsCidadao>
<dataNascimento>655009200000</dataNascimento>
<sexo>1</sexo>
<localDeAtendimento>1</localDeAtendimento>
<tipoAtendimento>2</tipoAtendimento>
<turno>0</turno>
<cid10>Z000</cid10>
<condutas>1</condutas>
<stNaoPossuiCpf>false</stNaoPossuiCpf>`,
    });
    const before = validateFaiXml(xml);
    expect(before.findings.some((f) => f.code === 'TURNO')).toBe(true);
    const r = applyFaiAutoFixes(xml, before.findings);
    expect(r.xml).toMatch(/<turno>2<\/turno>/);
    expect(validateFaiXml(r.xml).findings.some((f) => f.code === 'TURNO')).toBe(false);
  });

  it('LOCAL_ATENDIMENTO ausente → default 1 (localDeAtendimento)', () => {
    const xml = faiXml({
      child: `<cnsCidadao>${CNS_OK}</cnsCidadao>
<dataNascimento>655009200000</dataNascimento>
<sexo>1</sexo>
<tipoAtendimento>2</tipoAtendimento>
<turno>2</turno>
<cid10>Z000</cid10>
<condutas>1</condutas>
<stNaoPossuiCpf>false</stNaoPossuiCpf>`,
    });
    const before = validateFaiXml(xml);
    expect(before.findings.some((f) => f.code === 'LOCAL_ATENDIMENTO')).toBe(true);
    const r = applyFaiAutoFixes(xml, before.findings);
    expect(r.xml).toMatch(/<localDeAtendimento>1<\/localDeAtendimento>/);
    expect(r.xml).not.toMatch(/<localAtendimento>/);
  });

  it('IBGE_FORMAT → 3516200', () => {
    const xml = faiXml({ ibge: '35162' });
    const before = validateFaiXml(xml);
    expect(before.findings.some((f) => f.code === 'IBGE_FORMAT')).toBe(true);
    const r = applyFaiAutoFixes(xml, before.findings);
    expect(r.xml).toMatch(/<codigoIbgeMunicipio>3516200<\/codigoIbgeMunicipio>/);
  });

  it('TP_CDS_ORIGEM_NOT_3 → 3', () => {
    const xml = faiXml({ tp: '1' });
    const before = validateFaiXml(xml);
    expect(before.findings.some((f) => f.code === 'TP_CDS_ORIGEM_NOT_3')).toBe(true);
    const r = applyFaiAutoFixes(xml, before.findings);
    expect(r.xml).toMatch(/<tpCdsOrigem>3<\/tpCdsOrigem>/);
  });

  it('UUID_FICHA_CASE maiúsculas', () => {
    const xml = faiXml({ uuid: '2035871-4f1fda7e-b1d8-4496-afb4-5adcbc6389c7' });
    const before = validateFaiXml(xml);
    expect(before.findings.some((f) => f.code === 'UUID_FICHA_CASE')).toBe(true);
    const r = fixUuidFichaCase(xml);
    expect(r.xml).toMatch(/4F1FDA7E-B1D8-4496-AFB4-5ADCBC6389C7/);
  });

  it('XML_ENCODING → utf-8', () => {
    const xml = faiXml({ encoding: 'ISO-8859-1' });
    const before = validateFaiXml(xml);
    expect(before.findings.some((f) => f.code === 'XML_ENCODING')).toBe(true);
    const r = fixXmlEncoding(xml);
    expect(r.xml).toMatch(/encoding="utf-8"/);
  });

  it('CNS_FORMAT dígitos (checksum ok)', () => {
    const xml = faiXml({
      child: `<cnsCidadao>703 6010 4032 1538</cnsCidadao>
<dataNascimento>655009200000</dataNascimento>
<sexo>1</sexo>
<localDeAtendimento>1</localDeAtendimento>
<tipoAtendimento>2</tipoAtendimento>
<turno>2</turno>
<cid10>Z000</cid10>
<condutas>1</condutas>
<stNaoPossuiCpf>false</stNaoPossuiCpf>`,
    });
    const before = validateFaiXml(xml);
    expect(before.findings.some((f) => f.code === 'CNS_FORMAT')).toBe(true);
    const r = fixCitizenIdDigits(xml);
    expect(r.xml).toContain(`<cnsCidadao>${CNS_OK}</cnsCidadao>`);
  });

  it('CIAP_FORMAT / CID_FORMAT', () => {
    const xml = faiXml({
      child: `<cnsCidadao>${CNS_OK}</cnsCidadao>
<dataNascimento>655009200000</dataNascimento>
<sexo>1</sexo>
<localDeAtendimento>1</localDeAtendimento>
<tipoAtendimento>2</tipoAtendimento>
<turno>2</turno>
<ciap> a98 </ciap>
<cid10> z00.0 </cid10>
<condutas>1</condutas>
<stNaoPossuiCpf>false</stNaoPossuiCpf>`,
    });
    const before = validateFaiXml(xml);
    expect(before.findings.some((f) => f.code === 'CIAP_FORMAT')).toBe(true);
    expect(before.findings.some((f) => f.code === 'CID_FORMAT')).toBe(true);
    expect(fixCiapFormat(xml).xml).toMatch(/<ciap>A98<\/ciap>/);
    expect(fixCidFormat(xml).xml).toMatch(/<cid10>Z00.0<\/cid10>/);
  });

  it('PROC_QTD 0 → 1', () => {
    const xml = faiXml({
      child: `<cnsCidadao>${CNS_OK}</cnsCidadao>
<dataNascimento>655009200000</dataNascimento>
<sexo>1</sexo>
<localDeAtendimento>1</localDeAtendimento>
<tipoAtendimento>2</tipoAtendimento>
<turno>2</turno>
<cid10>Z000</cid10>
<condutas>1</condutas>
<stNaoPossuiCpf>false</stNaoPossuiCpf>
<procedimentosRealizados><coMsProcedimento>0301010153</coMsProcedimento><quantidade>0</quantidade></procedimentosRealizados>`,
    });
    const before = validateFaiXml(xml);
    expect(before.findings.some((f) => f.code === 'PROC_QTD')).toBe(true);
    const r = applyFaiAutoFixes(xml, before.findings);
    expect(r.xml).toMatch(/<quantidade>1<\/quantidade>/);
  });

  it('CONDUTA_MISSING / PROBLEMAS_MISSING / TIPO_ATENDIMENTO não são auto', () => {
    expect(FAI_SUGGEST_ONLY_CODES.has('CONDUTA_MISSING')).toBe(true);
    expect(FAI_SUGGEST_ONLY_CODES.has('PROBLEMAS_MISSING')).toBe(true);
    expect(FAI_SUGGEST_ONLY_CODES.has('TIPO_ATENDIMENTO')).toBe(true);
    expect(FAI_AUTO_FIXABLE_CODES.has('CONDUTA_MISSING')).toBe(false);
    const xml = faiXml({
      child: `<cnsCidadao>${CNS_OK}</cnsCidadao>
<dataNascimento>655009200000</dataNascimento>
<sexo>1</sexo>
<localDeAtendimento>1</localDeAtendimento>
<turno>2</turno>
<stNaoPossuiCpf>false</stNaoPossuiCpf>`,
    });
    const before = validateFaiXml(xml);
    expect(before.findings.some((f) => f.code === 'CONDUTA_MISSING')).toBe(true);
    expect(before.findings.some((f) => f.code === 'PROBLEMAS_MISSING')).toBe(true);
    expect(before.findings.some((f) => f.code === 'TIPO_ATENDIMENTO')).toBe(true);
    const r = applyFaiAutoFixes(xml, before.findings);
    expect(r.xml).not.toMatch(/<condutas>/);
    expect(r.xml).not.toMatch(/<cid10>/);
    expect(r.xml).not.toMatch(/<tipoAtendimento>/);
    const auto = classifyAutoFixable(before.findings, 'FAI');
    expect(auto).not.toContain('CONDUTA_MISSING');
    expect(auto).not.toContain('PROBLEMAS_MISSING');
  });

  it('CNS_INVALID (checksum) permanece manual', () => {
    const xml = faiXml({
      child: `<cnsCidadao>703601040321539</cnsCidadao>
<dataNascimento>655009200000</dataNascimento>
<sexo>1</sexo>
<localDeAtendimento>1</localDeAtendimento>
<tipoAtendimento>2</tipoAtendimento>
<turno>2</turno>
<cid10>Z000</cid10>
<condutas>1</condutas>
<stNaoPossuiCpf>false</stNaoPossuiCpf>`,
    });
    const before = validateFaiXml(xml);
    expect(before.findings.some((f) => f.code === 'CNS_INVALID')).toBe(true);
    const r = applyFaiAutoFixes(xml, before.findings);
    expect(r.xml).toContain('703601040321539');
    expect(validateFaiXml(r.xml).findings.some((f) => f.code === 'CNS_INVALID')).toBe(true);
  });

  it('condutas FAI explícitas (ficha, não lote)', () => {
    const xml = faiXml({
      child: `<cnsCidadao>${CNS_OK}</cnsCidadao>
<dataNascimento>655009200000</dataNascimento>
<sexo>1</sexo>
<localDeAtendimento>1</localDeAtendimento>
<tipoAtendimento>2</tipoAtendimento>
<turno>2</turno>
<cid10>Z000</cid10>
<stNaoPossuiCpf>false</stNaoPossuiCpf>`,
    });
    const r = fixCondutasFai(xml, [1]);
    expect(r.xml).toMatch(/<condutas>1<\/condutas>/);
  });

  it('fluxo dry-run/apply: ST+turno sem inventar CIAP', () => {
    const xml = faiXml({
      tp: '1',
      child: `<cnsCidadao>${CNS_OK}</cnsCidadao>
<dataNascimento>655009200000</dataNascimento>
<sexo>1</sexo>
<localDeAtendimento>1</localDeAtendimento>
<tipoAtendimento>2</tipoAtendimento>
<turno>0</turno>
<cid10>Z000</cid10>
<condutas>1</condutas>`,
    });
    const before = validateFaiXml(xml);
    const dry = runAutoFixPipeline(xml, before.findings, { fichaTipo: 'FAI', stNaoPossuiCpf: true });
    expect(dry.changed).toBe(true);
    const afterDry = validateFaiXml(dry.xml);
    expect(afterDry.findings.some((f) => f.code === 'ST_NAO_POSSUI_CPF')).toBe(false);
    expect(afterDry.findings.some((f) => f.code === 'TURNO')).toBe(false);
    expect(afterDry.findings.some((f) => f.code === 'TP_CDS_ORIGEM_NOT_3')).toBe(false);
    expect(dry.xml).toMatch(/<cid10>Z000<\/cid10>/);
    expect(dry.xml).not.toMatch(/<ciap>D82<\/ciap>/);

    const apply = runAutoFixPipeline(xml, before.findings, { fichaTipo: 'FAI', stNaoPossuiCpf: true });
    expect(apply.xml).toBe(dry.xml);
    const again = runAutoFixPipeline(apply.xml, validateFaiXml(apply.xml).findings, {
      fichaTipo: 'FAI',
      stNaoPossuiCpf: true,
    });
    expect(again.changed).toBe(false);
  });

  it('códigos FAI auto ⊆ AUTO_FIXABLE_CODES / registry', () => {
    const fromReg = new Set(autoFixableCodes());
    for (const c of FAI_AUTO_FIXABLE_CODES) {
    if (c === 'JUSTIFICATIVA_CPF_UNEXPECTED') continue;
      expect(fromReg.has(c) || AUTO_FIXABLE_CODES.has(c)).toBe(true);
    }
  });
});
