/**
 * Goldens / mutações: 1 XML mínimo por BLOCKER auto/semi corrigível
 * + pipeline upload→fix→zip (P5 sem browser).
 */

import { validateFaoXml } from './ledi-fao.validator';
import { validateFaiXml } from './ledi-fai.validator';
import { validateProcXml } from './ledi-proc.validator';
import {
  fixStNaoPossuiCpf,
  fixProblemasCondicoes,
  fixIne,
  fixCbo,
  fixTurno,
  fixLocalAtendimento,
  fixCnes,
  fixIbge,
  fixTiposVigilanciaSaudeBucal,
  fixTiposConsultaOdonto,
  fixTpCdsOrigem,
  fixProcFichaProcedimentos,
  fixGestante,
} from './ledi-fao-xml.fixer';
import { runAutoFixPipeline } from './ledi-autofix.pipeline';
import { buildStoreZip } from './zip-store';
import { LEDI_ERROR_REGISTRY } from './ledi-error-registry';

const BASE_FAO = `<?xml version="1.0" encoding="utf-8"?>
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
<stNaoPossuiCpf>false</stNaoPossuiCpf>
<tipoAtendimento>2</tipoAtendimento>
<tiposEncamOdonto>16</tiposEncamOdonto>
<tiposVigilanciaSaudeBucal>3</tiposVigilanciaSaudeBucal>
<tiposConsultaOdonto>1</tiposConsultaOdonto>
<procedimentosRealizados>
<coMsProcedimento>0301010030</coMsProcedimento>
<quantidade>1</quantidade>
</procedimentosRealizados>
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
<ine>0002165929</ine>
</lotacaoFormPrincipal>
<dataAtendimento>1786038654000</dataAtendimento>
<codigoIbgeMunicipio>3516200</codigoIbgeMunicipio>
</headerTransport>
</ns4:fichaAtendimentoOdontologicoMasterTransport>
</ns3:dadoTransporteTransportXml>`;

/** Mutação que introduz o código + fixer que o remove (quando auto). */
const GOLDEN_BLOCKERS: Array<{
  code: string;
  mutate: (xml: string) => string;
  fix?: (xml: string) => string;
}> = [
  {
    code: 'ST_NAO_POSSUI_CPF',
    mutate: (x) => x.replace(/<stNaoPossuiCpf>[\s\S]*?<\/stNaoPossuiCpf>\s*/i, ''),
    fix: (x) => fixStNaoPossuiCpf(x).xml,
  },
  {
    code: 'INE_MISSING',
    mutate: (x) =>
      x
        .replace(/<ineDadoSerializado>[\s\S]*?<\/ineDadoSerializado>/i, '<ineDadoSerializado></ineDadoSerializado>')
        .replace(/<ine>[\s\S]*?<\/ine>/gi, '<ine></ine>'),
    fix: (x) => fixIne(x, '0002165929').xml,
  },
  {
    code: 'PROBLEMAS_MISSING',
    mutate: (x) => x.replace(/<problemasCondicoes>[\s\S]*?<\/problemasCondicoes>\s*/i, ''),
    fix: (x) => fixProblemasCondicoes(x, [{ ciap: 'D82' }]).xml,
  },
  {
    code: 'VIGILANCIA_MISSING',
    mutate: (x) =>
      x.replace(/<tiposVigilanciaSaudeBucal>[\s\S]*?<\/tiposVigilanciaSaudeBucal>\s*/gi, ''),
    fix: (x) => fixTiposVigilanciaSaudeBucal(x, [3]).xml,
  },
  {
    code: 'TIPO_CONSULTA_REQUIRED',
    mutate: (x) => x.replace(/<tiposConsultaOdonto>[\s\S]*?<\/tiposConsultaOdonto>\s*/gi, ''),
    fix: (x) => fixTiposConsultaOdonto(x, [1]).xml,
  },
  {
    code: 'GESTANTE_MISSING',
    mutate: (x) => x.replace(/<gestante>[\s\S]*?<\/gestante>\s*/i, ''),
    fix: (x) => fixGestante(x, false).xml,
  },
  {
    code: 'TURNO',
    mutate: (x) => x.replace(/<turno>2<\/turno>/i, '<turno>0</turno>'),
    fix: (x) => fixTurno(x, 2).xml,
  },
  {
    code: 'LOCAL_ATENDIMENTO',
    mutate: (x) => x.replace(/<localAtendimento>1<\/localAtendimento>/i, '<localAtendimento>99</localAtendimento>'),
    fix: (x) => fixLocalAtendimento(x, 1).xml,
  },
  {
    code: 'CBO_NOT_ODONTO',
    mutate: (x) => x.replace(/<cboCodigo_2002>223208<\/cboCodigo_2002>/i, '<cboCodigo_2002>225125</cboCodigo_2002>'),
    fix: (x) => fixCbo(x, '223208').xml,
  },
  {
    code: 'CNES_FORMAT',
    mutate: (x) =>
      x
        .replace(/<cnesDadoSerializado>9647198<\/cnesDadoSerializado>/i, '<cnesDadoSerializado>123</cnesDadoSerializado>')
        .replace(/<cnes>9647198<\/cnes>/gi, '<cnes>123</cnes>'),
    fix: (x) => fixCnes(x, '9647198').xml,
  },
  {
    code: 'IBGE_FORMAT',
    mutate: (x) =>
      x
        .replace(/<codigoIbgeMunicipio>3516200<\/codigoIbgeMunicipio>/i, '<codigoIbgeMunicipio>35162</codigoIbgeMunicipio>')
        .replace(/<codIbge>3516200<\/codIbge>/i, '<codIbge>35162</codIbge>'),
    fix: (x) => fixIbge(x, '3516200').xml,
  },
  {
    code: 'TP_CDS_ORIGEM_MISSING',
    mutate: (x) => x.replace(/<tpCdsOrigem>3<\/tpCdsOrigem>/i, ''),
    fix: (x) => fixTpCdsOrigem(x, 3).xml,
  },
  {
    code: 'TP_CDS_ORIGEM_NOT_3',
    mutate: (x) => x.replace(/<tpCdsOrigem>3<\/tpCdsOrigem>/i, '<tpCdsOrigem>1</tpCdsOrigem>'),
    fix: (x) => fixTpCdsOrigem(x, 3).xml,
  },
];

describe('LEDI P5 golden BLOCKERs', () => {
  it('BASE_FAO sem blockers Siaps (exceto INFO/Previne)', () => {
    const r = validateFaoXml(BASE_FAO);
    expect(r.findings.some((f) => f.severity === 'BLOCKER')).toBe(false);
  });

  for (const g of GOLDEN_BLOCKERS) {
    it(`golden ${g.code}: detecta e corrige`, () => {
      expect(LEDI_ERROR_REGISTRY[g.code]).toBeTruthy();
      const bad = g.mutate(BASE_FAO);
      const before = validateFaoXml(bad);
      expect(before.findings.some((f) => f.code === g.code)).toBe(true);

      if (g.fix) {
        const fixed = g.fix(bad);
        const after = validateFaoXml(fixed);
        expect(after.findings.some((f) => f.code === g.code)).toBe(false);
      }
    });
  }
});

describe('LEDI P5 pipeline (upload→fix→zip)', () => {
  it('pipeline FAO: st + problemas → siapsReady + zip + idempotente', () => {
    let xml = BASE_FAO
      .replace(/<stNaoPossuiCpf>[\s\S]*?<\/stNaoPossuiCpf>\s*/i, '')
      .replace(/<problemasCondicoes>[\s\S]*?<\/problemasCondicoes>\s*/i, '');

    const before = validateFaoXml(xml);
    expect(before.siapsReady).toBe(false);

    const findings = before.findings;
    const step1 = runAutoFixPipeline(xml, findings, {
      stNaoPossuiCpf: true,
      problemasCondicoesDefault: [{ ciap: 'D82' }],
    });
    expect(step1.changed).toBe(true);

    const mid = validateFaoXml(step1.xml);
    const step2 = runAutoFixPipeline(step1.xml, mid.findings, {
      stNaoPossuiCpf: true,
      problemasCondicoesDefault: [{ ciap: 'D82' }],
    });
    // idempotência: reaplicar não deve alterar XML já corrigido (ou applied vazio)
    expect(step2.changed).toBe(false);

    const after = validateFaoXml(step1.xml);
    expect(after.siapsReady).toBe(true);

    const zip = buildStoreZip([{ name: 'f.xml', data: step1.xml }]);
    expect(zip.length).toBeGreaterThan(40);
  });

  it('FAI: stNaoPossuiCpf auto', () => {
    const fai = `<?xml version="1.0" encoding="utf-8"?>
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
</atendimentosIndividuais>
</ns4:fichaAtendimentoIndividualMasterTransport>
</ns3:dadoTransporteTransportXml>`;
    const before = validateFaiXml(fai);
    expect(before.findings.some((f) => f.code === 'ST_NAO_POSSUI_CPF')).toBe(true);
    const fixed = fixStNaoPossuiCpf(fai).xml;
    expect(validateFaiXml(fixed).findings.some((f) => f.code === 'ST_NAO_POSSUI_CPF')).toBe(false);
  });

  it('PROC: ABPG → SIGTAP via fixProcFichaProcedimentos', () => {
    const proc = `<?xml version="1.0" encoding="utf-8"?>
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
<stNaoPossuiCpf>false</stNaoPossuiCpf>
<turno>1</turno>
<procedimentos>ABPG028</procedimentos>
</atendProcedimentos>
</ns4:fichaProcedimentoMasterTransport>
</ns3:dadoTransporteTransportXml>`;
    expect(validateProcXml(proc).findings.some((f) => f.code === 'PROC_CODE_ABPG')).toBe(true);
    const fixed = fixProcFichaProcedimentos(proc, ['0301100039']).xml;
    expect(validateProcXml(fixed).findings.some((f) => f.code === 'PROC_CODE_ABPG')).toBe(false);
  });
});
