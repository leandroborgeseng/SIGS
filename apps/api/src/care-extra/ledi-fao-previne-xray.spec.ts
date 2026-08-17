import { analyzePrevineEsbXray, aggregatePrevineXrays, normSigtap } from './ledi-fao-previne-xray';
import { validateFaoXml } from './ledi-fao.validator';

describe('ledi-fao-previne-xray', () => {
  it('normaliza SIGTAP', () => {
    expect(normSigtap('03.01.01.015-3')).toBe('0301010153');
  });

  it('aponta gap B1 sem 1ª consulta e B5 sem preventivo', () => {
    const master = {
      uuidFicha: '9647198-4F1FDA7E-B1D8-4496-AFB4-5ADCBC6389C7',
      tpCdsOrigem: 3,
      headerTransport: {
        lotacaoFormPrincipal: {
          profissionalCNS: '126090861660005',
          cboCodigo_2002: '223208',
          cnes: '9647198',
          ine: '0002165929',
        },
        codigoIbgeMunicipio: '3516200',
      },
      atendimentosOdontologicos: [
        {
          cnsCidadao: '703601040321538',
          stNaoPossuiCpf: false,
          tipoAtendimento: 2,
          tiposConsultaOdonto: [1],
          tiposVigilanciaSaudeBucal: [99],
          tiposEncamOdonto: [11],
          problemasCondicoes: [{ ciap: 'D82' }],
          procedimentosRealizados: [{ coMsProcedimento: '0307010120', quantidade: 1 }],
        },
      ],
    };

    const xray = analyzePrevineEsbXray(master);
    expect(xray.signals.hasFirstConsultaProgramada).toBe(false);
    expect(xray.gaps.some((g) => g.code === 'PREVINE_B1_NO_FIRST_CONSULTA')).toBe(true);
    expect(xray.gaps.some((g) => g.code === 'PREVINE_B5_NO_PREVENTIVE')).toBe(true);
    expect(xray.gaps.some((g) => g.code === 'PREVINE_B6_NO_ART')).toBe(true);
    expect(xray.gaps.some((g) => g.code === 'PREVINE_VIGILANCIA_99')).toBe(true);
    expect(xray.summary.moneyRisks).toBeGreaterThan(0);

    const agg = aggregatePrevineXrays([{ fileName: 'a.xml', xray }]);
    expect(agg.files).toBe(1);
    expect(agg.indicators).toHaveLength(6);
    expect(agg.indicators.find((i) => i.id === 'B4')?.status).toBe('n/a');
    expect(agg.indicators.find((i) => i.id === 'B1')?.withGap).toBeGreaterThan(0);
    expect(agg.signalRates.withExodontia).toBe(0);
  });

  it('validateFaoXml inclui previneXray e flags de envio', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<ns3:dadoTransporteTransportXml xmlns:ns3="http://esus.ufsc.br/dadotransporte" xmlns:ns4="http://esus.ufsc.br/fichaatendimentoodontologicomaster">
<uuidDadoSerializado>9647198-4F1FDA7E-B1D8-4496-AFB4-5ADCBC6389C7</uuidDadoSerializado>
<tipoDadoSerializado>5</tipoDadoSerializado>
<codIbge>3516200</codIbge>
<cnesDadoSerializado>9647198</cnesDadoSerializado>
<ineDadoSerializado>0002165929</ineDadoSerializado>
<ns4:fichaAtendimentoOdontologicoMasterTransport>
<uuidFicha>9647198-4F1FDA7E-B1D8-4496-AFB4-5ADCBC6389C7</uuidFicha>
<tpCdsOrigem>3</tpCdsOrigem>
<atendimentosOdontologicos>
<cnsCidadao>703601040321538</cnsCidadao>
<localAtendimento>1</localAtendimento>
<gestante>false</gestante>
<stNaoPossuiCpf>false</stNaoPossuiCpf>
<tipoAtendimento>2</tipoAtendimento>
<tiposEncamOdonto>15</tiposEncamOdonto>
<tiposVigilanciaSaudeBucal>3</tiposVigilanciaSaudeBucal>
<tiposConsultaOdonto>1</tiposConsultaOdonto>
<procedimentosRealizados><coMsProcedimento>0301010153</coMsProcedimento><quantidade>1</quantidade></procedimentosRealizados>
<procedimentosRealizados><coMsProcedimento>0101020104</coMsProcedimento><quantidade>1</quantidade></procedimentosRealizados>
<problemasCondicoes><ciap>D82</ciap></problemasCondicoes>
<turno>2</turno>
<sexo>1</sexo>
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

    const report = validateFaoXml(xml);
    expect(report.previneXray).toBeTruthy();
    expect(report.previneXray!.signals.hasFirstConsultaProgramada).toBe(true);
    expect(report.previneXray!.signals.hasTratamentoConcluido).toBe(true);
    expect(report.previneXray!.gaps.some((g) => g.code === 'PREVINE_B1_NO_FIRST_CONSULTA')).toBe(false);
    expect(typeof report.siapsReady).toBe('boolean');
    expect(typeof report.readyForFinalSend).toBe('boolean');
    expect(report.previneXray!.channel).toBe('PREVINE_ESB_B1_B6');
  });
});
