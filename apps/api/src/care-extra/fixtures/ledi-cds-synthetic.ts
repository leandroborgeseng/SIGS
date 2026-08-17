/**
 * Fixtures sintéticas LEDI CDS (tipos 2/3/6/8/10) — sem PHI real.
 * CNS/CNES de exemplo alinhados aos testes FAI/PROC existentes.
 */

const CNS = '703601040321538';
const CNES = '2035871';
const INE = '0002321246';
const CBO = '225125';
const IBGE = '3516200';
const UUID = '2035871-4F1FDA7E-B1D8-4496-AFB4-5ADCBC6389C7';
const DATA = '1786038654000';

function envelope(opts: {
  tipo: number;
  masterOpen: string;
  masterClose: string;
  body: string;
  stNaoPossuiCpf?: boolean;
}): string {
  const st =
    opts.stNaoPossuiCpf === false
      ? ''
      : opts.stNaoPossuiCpf === true
        ? '<stNaoPossuiCpf>true</stNaoPossuiCpf><justificativaNaoPossuiCpf>99</justificativaNaoPossuiCpf>'
        : '<stNaoPossuiCpf>false</stNaoPossuiCpf>';
  return `<?xml version="1.0" encoding="utf-8"?>
<dadoTransporteTransportXml>
<tipoDadoSerializado>${opts.tipo}</tipoDadoSerializado>
<cnesDadoSerializado>${CNES}</cnesDadoSerializado>
<ineDadoSerializado>${INE}</ineDadoSerializado>
${opts.masterOpen}
<uuidFicha>${UUID}</uuidFicha>
<tpCdsOrigem>3</tpCdsOrigem>
<headerTransport>
<profissionalCNS>${CNS}</profissionalCNS>
<cboCodigo_2002>${CBO}</cboCodigo_2002>
<cnes>${CNES}</cnes>
<ine>${INE}</ine>
<dataAtendimento>${DATA}</dataAtendimento>
<codigoIbgeMunicipio>${IBGE}</codigoIbgeMunicipio>
</headerTransport>
${opts.body.replace('__ST__', st)}
${opts.masterClose}
</dadoTransporteTransportXml>`;
}

/** Tipo 2 — cadastro individual (apto Siaps sintético). */
export const FIXTURE_CADASTRO_INDIVIDUAL = envelope({
  tipo: 2,
  masterOpen: '<cadastroIndividualTransport>',
  masterClose: '</cadastroIndividualTransport>',
  body: `<cnsCidadao>${CNS}</cnsCidadao>
<dataNascimento>655009200000</dataNascimento>
<sexo>1</sexo>
__ST__`,
});

/** Tipo 2 sem stNaoPossuiCpf — BLOCKER autofixável. */
export const FIXTURE_CADASTRO_INDIVIDUAL_NO_ST = FIXTURE_CADASTRO_INDIVIDUAL.replace(
  /<stNaoPossuiCpf>false<\/stNaoPossuiCpf>\s*/i,
  '',
);

/** Tipo 3 — cadastro domiciliar. */
export const FIXTURE_CADASTRO_DOMICILIAR = envelope({
  tipo: 3,
  masterOpen: '<cadastroDomiciliarTransport>',
  masterClose: '</cadastroDomiciliarTransport>',
  body: `<tipoImovel>1</tipoImovel>
<numeroMoradores>3</numeroMoradores>
__ST__`,
  stNaoPossuiCpf: false,
}).replace(/__ST__\n?/, '');

/** Tipo 6 — atividade coletiva. */
export const FIXTURE_COLETIVO = envelope({
  tipo: 6,
  masterOpen: '<fichaAtividadeColetivaMasterTransport>',
  masterClose: '</fichaAtividadeColetivaMasterTransport>',
  body: `<tipoAtividade>5</tipoAtividade>
<numParticipantes>12</numParticipantes>
<turno>2</turno>
__ST__`,
  stNaoPossuiCpf: false,
}).replace(/__ST__\n?/, '');

/** Tipo 8 — visita ACS. */
export const FIXTURE_VISITA_ACS = envelope({
  tipo: 8,
  masterOpen: '<fichaVisitaDomiciliarMasterTransport>',
  masterClose: '</fichaVisitaDomiciliarMasterTransport>',
  body: `<visitasDomiciliares>
<cnsCidadao>${CNS}</cnsCidadao>
<turno>1</turno>
<desfecho>1</desfecho>
__ST__
</visitasDomiciliares>`,
});

export const FIXTURE_VISITA_ACS_NO_ST = FIXTURE_VISITA_ACS.replace(
  /<stNaoPossuiCpf>false<\/stNaoPossuiCpf>\s*/i,
  '',
);

/** Tipo 10 — AD. */
export const FIXTURE_AD = envelope({
  tipo: 10,
  masterOpen: '<fichaAtendimentoDomiciliarMasterTransport>',
  masterClose: '</fichaAtendimentoDomiciliarMasterTransport>',
  body: `<atendimentosDomiciliares>
<cnsCidadao>${CNS}</cnsCidadao>
<dataNascimento>655009200000</dataNascimento>
<sexo>1</sexo>
<turno>2</turno>
<atencaoDomiciliarModalidade>1</atencaoDomiciliarModalidade>
__ST__
</atendimentosDomiciliares>`,
});

export const FIXTURE_AD_NO_ST = FIXTURE_AD.replace(/<stNaoPossuiCpf>false<\/stNaoPossuiCpf>\s*/i, '');

export const CDS_FIXTURE_META = {
  note: 'Sintético — dump Franca 5974691 só trouxe tipos 4/5/7. Schema por enum/tag Transport.',
  cns: CNS,
  cnes: CNES,
  ine: INE,
} as const;
