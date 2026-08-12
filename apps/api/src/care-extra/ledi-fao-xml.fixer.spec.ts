import {
  fixStNaoPossuiCpf,
  applyAutoFixes,
  fixProblemasCondicoes,
  addProcedimentos,
  addTiposEncamOdonto,
  fixTiposVigilanciaSaudeBucal,
  fixTurno,
  fixGestante,
  fixJustificativaNaoPossuiCpf,
  fixCpfCidadao,
  fixDtNascimento,
  fixSexo,
  fixKeepCitizenId,
  fixTiposEncamOdonto,
  fixTpCdsOrigem,
  fixProcQuantidadeMin,
  fixCondutasMax,
  fixTipoConsultaMulti,
  fixUuidFichaLength,
  fixRemoveJustificativaNaoPossuiCpf,
  fixForceStNaoPossuiCpfTrue,
  fixProcFichaProcedimentos,
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

  it('corrige turno e gestante', () => {
    const noTurno = SAMPLE.replace('<turno>2</turno>', '');
    const t = fixTurno(noTurno, 1);
    expect(t.changed).toBe(true);
    expect(t.xml).toMatch(/<turno>1<\/turno>/);
    const g = fixGestante(t.xml.replace(/<gestante>false<\/gestante>/, ''), false);
    expect(g.changed).toBe(true);
    expect(g.xml).toMatch(/<gestante>false<\/gestante>/);
  });

  it('preenche justificativaNaoPossuiCpf e stNaoPossuiCpf=true', () => {
    const withSt = SAMPLE.replace(
      '</gestante>',
      '</gestante>\n<stNaoPossuiCpf>true</stNaoPossuiCpf>',
    );
    const before = validateFaoXml(withSt);
    expect(before.findings.some((f) => f.code === 'JUSTIFICATIVA_CPF_MISSING')).toBe(true);

    const { xml, changed } = fixJustificativaNaoPossuiCpf(withSt, 5);
    expect(changed).toBe(true);
    expect(xml).toMatch(/<justificativaNaoPossuiCpf>5<\/justificativaNaoPossuiCpf>/);
    expect(xml).toMatch(/<stNaoPossuiCpf>true<\/stNaoPossuiCpf>/);

    const after = validateFaoXml(xml);
    expect(after.findings.some((f) => f.code === 'JUSTIFICATIVA_CPF_MISSING')).toBe(false);
  });

  it('P1: corrige CPF, nascimento, sexo e condutas', () => {
    const noBirth = SAMPLE.replace(/<dtNascimento>[\s\S]*?<\/dtNascimento>/i, '');
    const born = fixDtNascimento(noBirth, '1990-05-12');
    expect(born.changed).toBe(true);
    expect(born.xml).toMatch(/<dtNascimento>\d{10,13}<\/dtNascimento>/);

    const sex = fixSexo(born.xml, '0');
    expect(sex.changed).toBe(true);
    expect(sex.xml).toMatch(/<sexo>0<\/sexo>/);

    const withBoth = sex.xml.replace(
      '<cnsCidadao>703601040321538</cnsCidadao>',
      '<cnsCidadao>703601040321538</cnsCidadao>\n<cpfCidadao>52998224725</cpfCidadao>',
    );
    const keep = fixKeepCitizenId(withBoth, 'cns');
    expect(keep.changed).toBe(true);
    expect(keep.xml).toMatch(/<cnsCidadao>/);
    expect(keep.xml).not.toMatch(/<cpfCidadao>/);

    const cpf = fixCpfCidadao(SAMPLE.replace(/<cnsCidadao>[\s\S]*?<\/cnsCidadao>/i, ''), '52998224725');
    expect(cpf.changed).toBe(true);
    expect(cpf.xml).toMatch(/<cpfCidadao>52998224725<\/cpfCidadao>/);

    const cond = fixTiposEncamOdonto(SAMPLE, [15, 1]);
    expect(cond.changed).toBe(true);
    expect(cond.xml).toMatch(/<tiposEncamOdonto>15<\/tiposEncamOdonto>/);
    expect(cond.xml).toMatch(/<tiposEncamOdonto>1<\/tiposEncamOdonto>/);
    expect(cond.xml).not.toMatch(/<tiposEncamOdonto>16<\/tiposEncamOdonto>/);
  });

  it('P2: tpCdsOrigem, proc qtd, caps e uuid', () => {
    const noOrigem = SAMPLE.replace(/<tpCdsOrigem>3<\/tpCdsOrigem>/i, '');
    const origem = fixTpCdsOrigem(noOrigem, 3);
    expect(origem.changed).toBe(true);
    expect(origem.xml).toMatch(/<tpCdsOrigem>3<\/tpCdsOrigem>/);

    const badOrigem = SAMPLE.replace(/<tpCdsOrigem>3<\/tpCdsOrigem>/i, '<tpCdsOrigem>1</tpCdsOrigem>');
    expect(fixTpCdsOrigem(badOrigem, 3).xml).toMatch(/<tpCdsOrigem>3<\/tpCdsOrigem>/);

    const badQty = SAMPLE.replace('<quantidade>1</quantidade>', '<quantidade>0</quantidade>');
    const qty = fixProcQuantidadeMin(badQty, 1);
    expect(qty.changed).toBe(true);
    expect(qty.xml).toMatch(/<quantidade>1<\/quantidade>/);

    const tags = Array.from({ length: 20 }, (_, i) => `<tiposEncamOdonto>${i + 1}</tiposEncamOdonto>`).join(
      '\n',
    );
    const manyEnc = SAMPLE.replace(/<tiposEncamOdonto>16<\/tiposEncamOdonto>/i, tags);
    const encMax = fixCondutasMax(manyEnc, 17);
    expect(encMax.changed).toBe(true);
    expect((encMax.xml.match(/<tiposEncamOdonto>/gi) || []).length).toBe(17);

    const multi = SAMPLE.replace(
      '<tiposConsultaOdonto>1</tiposConsultaOdonto>',
      '<tiposConsultaOdonto>1</tiposConsultaOdonto>\n<tiposConsultaOdonto>2</tiposConsultaOdonto>',
    );
    const one = fixTipoConsultaMulti(multi);
    expect(one.changed).toBe(true);
    expect((one.xml.match(/<tiposConsultaOdonto>/gi) || []).length).toBe(1);

    const shortUuid = SAMPLE.replace(
      /<uuidFicha>[\s\S]*?<\/uuidFicha>/i,
      '<uuidFicha>abc</uuidFicha>',
    );
    const uuid = fixUuidFichaLength(shortUuid);
    expect(uuid.changed).toBe(true);
    const m = uuid.xml.match(/<uuidFicha>([^<]+)<\/uuidFicha>/i);
    expect(m?.[1].length).toBeGreaterThanOrEqual(36);
    expect(m?.[1].length).toBeLessThanOrEqual(44);

    const withJust = SAMPLE.replace(
      '</sexo>',
      '</sexo>\n<stNaoPossuiCpf>false</stNaoPossuiCpf>\n<justificativaNaoPossuiCpf>5</justificativaNaoPossuiCpf>',
    );
    const removed = fixRemoveJustificativaNaoPossuiCpf(withJust);
    expect(removed.changed).toBe(true);
    expect(removed.xml).not.toMatch(/justificativaNaoPossuiCpf/);

    const forced = fixForceStNaoPossuiCpfTrue(withJust);
    expect(forced.xml).toMatch(/<stNaoPossuiCpf>true<\/stNaoPossuiCpf>/);
  });

  it('P3: substitui procedimentos da ficha tipo 7', () => {
    const sample = `<?xml version="1.0"?><root><atendProcedimentos>
<turno>1</turno>
<procedimentos>ABPG028</procedimentos>
</atendProcedimentos></root>`;
    const r = fixProcFichaProcedimentos(sample, ['0301100039']);
    expect(r.changed).toBe(true);
    expect(r.xml).toMatch(/<procedimentos>0301100039<\/procedimentos>/);
    expect(r.xml).not.toMatch(/ABPG/);
  });
});
