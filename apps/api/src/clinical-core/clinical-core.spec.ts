import { evaluatePatientMatch, nameSimilarity } from './patient-match';
import { lediXmlToComposition } from './adapters/ledi-xml.adapter';
import { runRulesEngine } from './rules-engine';
import { rndsExportStub } from './exporters/rnds.exporter';

const SAMPLE_FAO = `<?xml version="1.0" encoding="utf-8"?>
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

describe('clinical-core A0', () => {
  it('lediXmlToComposition extrai Patient/Encounter FHIR-like', () => {
    const c = lediXmlToComposition(SAMPLE_FAO);
    expect(c.resourceType).toBe('Composition');
    expect(c.fichaTipo).toBe('FAO');
    expect(c.encounters.length).toBeGreaterThanOrEqual(1);
    const p = c.encounters[0]!.patient!;
    expect(p.identifiers.some((i: { system: string }) => i.system === 'cns')).toBe(true);
    expect(c.encounters[0]!.procedures[0]?.code).toBe('0301010030');
    expect(c.sourceFormat).toBe('ledi-xml');
  });

  it('runRulesEngine usa o mesmo validador FAO (findings LEDI; Previne separado)', () => {
    const r = runRulesEngine({ xml: SAMPLE_FAO, rulePack: 'FAO' });
    expect(r.audit.some((a) => a.action === 'normalize')).toBe(true);
    expect(r.audit.some((a) => a.action === 'validate')).toBe(true);
    expect(r.findings.some((f) => f.code === 'ST_NAO_POSSUI_CPF')).toBe(true);
    expect(r.findings.some((f) => String(f.code).startsWith('PREVINE_'))).toBe(false);
    expect(r.previneXray).toBeTruthy();
    expect(r.composition.fichaTipo).toBe('FAO');
    expect(r.rulePack).toBe('FAO');
  });

  it('evaluatePatientMatch: CPF idêntico → HIGH auto_merge', () => {
    const m = evaluatePatientMatch(
      { cpf: '529.982.247-25', civilName: 'Ana Silva', birthDate: '1990-01-01' },
      { cpf: '52998224725', civilName: 'Ana Silva', birthDate: '1990-01-01' },
    );
    expect(m.confidence).toBe('HIGH');
    expect(m.action).toBe('auto_merge');
  });

  it('evaluatePatientMatch: DN+nome forte → MEDIUM review', () => {
    const m = evaluatePatientMatch(
      { civilName: 'Maria Clara Souza', birthDate: '1988-05-10', motherName: 'Joana Souza' },
      { civilName: 'Maria Clara de Souza', birthDate: '1988-05-10', motherName: 'Joana Souza' },
    );
    expect(m.confidence).toBe('MEDIUM');
    expect(m.action).toBe('pending_review');
  });

  it('evaluatePatientMatch: pouco sinal → LOW signal_only', () => {
    const m = evaluatePatientMatch(
      { civilName: 'Joao', birthDate: '2000-01-01' },
      { civilName: 'Pedro', birthDate: '1999-01-01' },
    );
    expect(m.confidence).toBe('LOW');
    expect(m.action).toBe('signal_only');
  });

  it('nameSimilarity trata acentos', () => {
    expect(nameSimilarity('José Antônio', 'Jose Antonio')).toBeGreaterThan(0.9);
  });

  it('rndsExportStub reserva contrato A4', () => {
    const r = rndsExportStub({ productionRecordIds: ['a', 'b'] });
    expect(r.status).toBe('not_implemented');
    expect(r.requestedIds).toEqual(['a', 'b']);
  });
});
