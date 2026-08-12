import { readFileSync } from 'fs';
import { join } from 'path';
import { isValidCns, isValidCpf, validateFaoJson, validateFaoXml } from './ledi-fao.validator';

const FIXTURE = join(
  __dirname,
  '../../../../data/esus/5.5.24/fixtures/ledi/fao-nao-conforme.xml',
);

describe('ledi-fao.validator', () => {
  it('valida CPF/CNS', () => {
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCns('000000000000000')).toBe(false);
  });

  it('marca fixture XML como não conforme com críticas esperadas', () => {
    const xml = readFileSync(FIXTURE, 'utf8');
    const report = validateFaoXml(xml);
    expect(report.conformant).toBe(false);
    expect(report.channel).toBe('LEDI_FAO_SIAPS_RNDS');
    expect(report.detectedFormat).toBe('ledi-fao');
    expect(report.summary.blockers).toBeGreaterThan(0);

    const codes = new Set(report.findings.map((f) => f.code));
    expect(codes.has('CBO_NOT_ODONTO')).toBe(true);
    expect(codes.has('CPF_CNS_BOTH')).toBe(true);
    expect(codes.has('GESTANTE_SEXO_MASC')).toBe(true);
    expect(codes.has('VIGILANCIA_MISSING')).toBe(true);
    expect(codes.has('PROBLEMAS_MISSING')).toBe(true);
    expect(codes.has('PROC_ESCUTA_FORBIDDEN')).toBe(true);
    expect(codes.has('ALTA_EPISODIO_RULE') || codes.has('TRATAMENTO_CONCLUIDO_RULE')).toBe(true);
  });

  it('rejeita Bundle FHIR com mensagem de canal', () => {
    const xml = `<?xml version="1.0"?><Bundle xmlns="http://hl7.org/fhir"><type value="document"/></Bundle>`;
    const report = validateFaoXml(xml);
    expect(report.conformant).toBe(false);
    expect(report.findings.some((f) => f.code === 'FORMAT_FHIR_NOT_FAO')).toBe(true);
  });

  it('extrai FAO de envelope dadoTransporteTransportXml (export SIGS/PEC)', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<ns3:dadoTransporteTransportXml xmlns:ns3="http://esus.ufsc.br/dadotransporte" xmlns:ns4="http://esus.ufsc.br/fichaatendimentoodontologicomaster">
  <tipoDadoSerializado>5</tipoDadoSerializado>
  <cnesDadoSerializado>2051796</cnesDadoSerializado>
  <ineDadoSerializado>0002426447</ineDadoSerializado>
  <ns4:fichaAtendimentoOdontologicoMasterTransport>
    <uuidFicha>2051796-6DC27592-07B8-419C-B94F-9FE079C6224B</uuidFicha>
    <tpCdsOrigem>3</tpCdsOrigem>
    <atendimentosOdontologicos>
      <cnsCidadao>700008619970105</cnsCidadao>
      <dtNascimento>49950000000</dtNascimento>
      <localAtendimento>1</localAtendimento>
      <gestante>false</gestante>
      <tipoAtendimento>2</tipoAtendimento>
      <tiposEncamOdonto>11</tiposEncamOdonto>
      <tiposVigilanciaSaudeBucal>99</tiposVigilanciaSaudeBucal>
      <tiposConsultaOdonto>2</tiposConsultaOdonto>
      <procedimentosRealizados>
        <coMsProcedimento>0101020031</coMsProcedimento>
        <quantidade>1</quantidade>
      </procedimentosRealizados>
      <turno>2</turno>
      <sexo>1</sexo>
      <dataHoraInicialAtendimento>1786378279000</dataHoraInicialAtendimento>
      <dataHoraFinalAtendimento>1786379952000</dataHoraFinalAtendimento>
    </atendimentosOdontologicos>
    <headerTransport>
      <lotacaoFormPrincipal>
        <profissionalCNS>700003067245908</profissionalCNS>
        <cboCodigo_2002>223208</cboCodigo_2002>
        <cnes>2051796</cnes>
      </lotacaoFormPrincipal>
      <dataAtendimento>1786378279000</dataAtendimento>
      <codigoIbgeMunicipio>3516200</codigoIbgeMunicipio>
    </headerTransport>
  </ns4:fichaAtendimentoOdontologicoMasterTransport>
</ns3:dadoTransporteTransportXml>`;
    const report = validateFaoXml(xml);
    expect(report.detectedFormat).toBe('ledi-fao');
    expect(report.findings.some((f) => f.code === 'FORMAT_DADO_TRANSPORT')).toBe(false);
    expect(report.masterPreview?.cbo).toBe('223208');
    const codes = new Set(report.findings.map((f) => f.code));
    expect(codes.has('ST_NAO_POSSUI_CPF')).toBe(true);
    expect(codes.has('PROBLEMAS_MISSING')).toBe(true);
  });

  it('aceita master JSON conforme (sem blockers/money)', () => {
    const now = Date.now();
    const report = validateFaoJson({
      uuidFicha: '2094307-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      tpCdsOrigem: 3,
      headerTransport: {
        profissionalCNS: '700000000000005',
        cboCodigo_2002: '223208',
        cnes: '2094307',
        ine: '0000123456',
        dataAtendimento: now - 7200000,
        codigoIbgeMunicipio: '3516200',
        lotacaoFormPrincipal: {
          profissionalCNS: '700000000000005',
          cboCodigo_2002: '223208',
          cnes: '2094307',
          ine: '0000123456',
        },
      },
      atendimentosOdontologicos: [
        {
          cpfCidadao: '52998224725',
          dtNascimento: Date.UTC(1990, 0, 1),
          sexo: 1,
          gestante: false,
          localAtendimento: 1,
          tipoAtendimento: 5,
          turno: 1,
          tiposEncamOdonto: [17],
          tiposVigilanciaSaudeBucal: [1],
          tiposConsultaOdonto: [],
          dataHoraInicialAtendimento: now - 3600000,
          dataHoraFinalAtendimento: now,
          stNaoPossuiCpf: false,
          procedimentosRealizados: [{ coMsProcedimento: '0101020010', quantidade: 1 }],
          problemasCondicoes: [{ ciap: 'D82' }],
        },
      ],
    });
    expect(report.sourceKind).toBe('json');
    expect(report.summary.blockers).toBe(0);
    expect(report.summary.moneyRisks).toBe(0);
    expect(report.conformant).toBe(true);
  });
});
