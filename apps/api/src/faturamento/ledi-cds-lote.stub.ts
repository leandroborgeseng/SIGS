/**
 * Catálogo live vs stub de lotes LEDI CDS.
 * Fonte de códigos: TipoDadoTranspEnum (e-SUS 5.5.24).
 */

export type LediCdsLoteStatus = 'live' | 'stub';

export type LediCdsLoteEntry = {
  code: number;
  id: string;
  label: string;
  loteXmlStatus: LediCdsLoteStatus;
  href: string;
  nativeHref?: string;
  masterTag: string;
  blocker: string | null;
};

export const LEDI_CDS_LOTES: LediCdsLoteEntry[] = [
  {
    code: 4,
    id: 'FAI',
    label: 'Atendimento Individual (FAI)',
    loteXmlStatus: 'live',
    href: '/faturamento/lote/fai',
    nativeHref: '/aps',
    masterTag: 'fichaAtendimentoIndividualMasterTransport',
    blocker: null,
  },
  {
    code: 5,
    id: 'FAO',
    label: 'Atendimento Odontológico (FAO)',
    loteXmlStatus: 'live',
    href: '/faturamento/lote/fao',
    nativeHref: '/odonto',
    masterTag: 'fichaAtendimentoOdontologicoMasterTransport',
    blocker: null,
  },
  {
    code: 7,
    id: 'PROCEDIMENTOS',
    label: 'Ficha de Procedimentos',
    loteXmlStatus: 'live',
    href: '/faturamento/lote/proc',
    masterTag: 'fichaProcedimentoMasterTransport',
    blocker: null,
  },
  {
    code: 3,
    id: 'CADASTRO_DOMICILIAR',
    label: 'Cadastro Domiciliar',
    loteXmlStatus: 'stub',
    href: '/faturamento/lote/domicilio',
    nativeHref: '/territorio',
    masterTag: 'cadastroDomiciliarTransport',
    blocker: 'Sem amostra XML no dump Franca 5974691; wizard ZIP adiado.',
  },
  {
    code: 8,
    id: 'VISITA_ACS',
    label: 'Visita Domiciliar (ACS)',
    loteXmlStatus: 'stub',
    href: '/faturamento/lote/visita-acs',
    nativeHref: '/territorio',
    masterTag: 'fichaVisitaDomiciliarMasterTransport',
    blocker: 'Sem amostra XML no dump Franca 5974691; wizard ZIP adiado.',
  },
  {
    code: 10,
    id: 'AD',
    label: 'Atendimento Domiciliar (AD)',
    loteXmlStatus: 'stub',
    href: '/faturamento/lote/ad',
    nativeHref: '/ad',
    masterTag: 'fichaAtendimentoDomiciliarMasterTransport',
    blocker: 'Sem amostra XML no dump Franca 5974691; origem nativa /ad ok.',
  },
];

export function listLediCdsLotes() {
  return {
    source: 'TipoDadoTranspEnum cds.common.api-5.5.24 + dump Franca 5974691 (só 4/5/7 com ZIP)',
    designDoc: 'docs/planejamento/desenho-lote-ledi-cds-3-8-10.md',
    live: LEDI_CDS_LOTES.filter((e) => e.loteXmlStatus === 'live'),
    stubs: LEDI_CDS_LOTES.filter((e) => e.loteXmlStatus === 'stub'),
    items: LEDI_CDS_LOTES,
  };
}
