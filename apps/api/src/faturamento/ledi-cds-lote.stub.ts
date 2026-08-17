/**
 * Catálogo live vs stub de lotes LEDI CDS.
 * Fonte de códigos: TipoDadoTranspEnum (e-SUS 5.5.24).
 * Live: 2/3/4/5/6/7/8/10. Stub: vacina 14 (não pedido nesta onda).
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
  /** true = schema/regras por enum+fixture (dump Franca sem amostra). */
  syntheticSchema?: boolean;
};

export const LEDI_CDS_LOTES: LediCdsLoteEntry[] = [
  {
    code: 2,
    id: 'CADASTRO_INDIVIDUAL',
    label: 'Cadastro Individual',
    loteXmlStatus: 'live',
    href: '/faturamento/lote/cadastro-individual',
    nativeHref: '/pacientes',
    masterTag: 'cadastroIndividualTransport',
    blocker: null,
    syntheticSchema: true,
  },
  {
    code: 3,
    id: 'CADASTRO_DOMICILIAR',
    label: 'Cadastro Domiciliar',
    loteXmlStatus: 'live',
    href: '/faturamento/lote/domicilio',
    nativeHref: '/territorio',
    masterTag: 'cadastroDomiciliarTransport',
    blocker: null,
    syntheticSchema: true,
  },
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
    code: 6,
    id: 'COLETIVO',
    label: 'Atividade Coletiva',
    loteXmlStatus: 'live',
    href: '/faturamento/lote/coletivo',
    nativeHref: '/coletivo',
    masterTag: 'fichaAtividadeColetivaMasterTransport',
    blocker: null,
    syntheticSchema: true,
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
    code: 8,
    id: 'VISITA_ACS',
    label: 'Visita Domiciliar (ACS)',
    loteXmlStatus: 'live',
    href: '/faturamento/lote/visita-acs',
    nativeHref: '/territorio',
    masterTag: 'fichaVisitaDomiciliarMasterTransport',
    blocker: null,
    syntheticSchema: true,
  },
  {
    code: 10,
    id: 'AD',
    label: 'Atendimento Domiciliar (AD)',
    loteXmlStatus: 'live',
    href: '/faturamento/lote/ad',
    nativeHref: '/ad',
    masterTag: 'fichaAtendimentoDomiciliarMasterTransport',
    blocker: null,
    syntheticSchema: true,
  },
  {
    code: 14,
    id: 'VACINA',
    label: 'Vacinação',
    loteXmlStatus: 'stub',
    href: '/vacinacao',
    nativeHref: '/vacinacao',
    masterTag: 'fichaVacinacaoMasterTransport',
    blocker: 'Lote ZIP vacina (14) fora desta onda; origem nativa /vacinacao.',
    syntheticSchema: true,
  },
];

export function listLediCdsLotes() {
  return {
    source:
      'TipoDadoTranspEnum cds.common.api-5.5.24 · dump Franca 4/5/7 · schema sintético 2/3/6/8/10',
    designDoc: 'docs/planejamento/desenho-lote-ledi-cds-3-8-10.md',
    live: LEDI_CDS_LOTES.filter((e) => e.loteXmlStatus === 'live'),
    stubs: LEDI_CDS_LOTES.filter((e) => e.loteXmlStatus === 'stub'),
    items: LEDI_CDS_LOTES,
  };
}
