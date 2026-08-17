/**
 * Catálogo SIGTAP local (piloto APS Franca) — sem zip MS.
 * Códigos estáveis usados no BPA stub, demos e fluxos TR parciais.
 * Nomes alinhados à nomenclatura SUS usual; confirmar na competência oficial quando o download voltar.
 */

export type SigtapSeedItem = {
  code: string;
  name: string;
  complex: string;
  groupCode: string;
  groupName: string;
  /** tags internas (não vão ao banco) */
  tags?: string[];
};

export const SIGTAP_SEED_COMPETENCIA = '202608';

export const SIGTAP_SEED: SigtapSeedItem[] = [
  // —— BPA stub / produção LEDI (obrigatórios no preflight) ——
  {
    code: '0301010064',
    name: 'Consulta médica em atenção básica',
    complex: 'Atenção Básica',
    groupCode: '03',
    groupName: 'Procedimentos clínicos',
    tags: ['bpa', 'individual'],
  },
  {
    code: '0301010030',
    name: 'Administração de imunobiológicos',
    complex: 'Atenção Básica',
    groupCode: '03',
    groupName: 'Procedimentos clínicos',
    tags: ['bpa', 'vacina'],
  },
  {
    code: '0101020010',
    name: 'Consulta odontológica',
    complex: 'Atenção Básica',
    groupCode: '01',
    groupName: 'Ações de promoção e prevenção',
    tags: ['bpa', 'odonto'],
  },
  {
    code: '0101040024',
    name: 'Atendimento / visita domiciliar',
    complex: 'Atenção Básica',
    groupCode: '01',
    groupName: 'Ações de promoção e prevenção',
    tags: ['bpa', 'ad'],
  },
  {
    code: '0101050011',
    name: 'Ação coletiva de educação em saúde',
    complex: 'Atenção Básica',
    groupCode: '01',
    groupName: 'Ações de promoção e prevenção',
    tags: ['bpa', 'coletivo'],
  },

  // —— Consultas / acolhimento APS ——
  {
    code: '0301010072',
    name: 'Consulta de profissionais de nível superior na atenção básica (exceto médico)',
    complex: 'Atenção Básica',
    groupCode: '03',
    groupName: 'Procedimentos clínicos',
    tags: ['aps', 'consulta'],
  },
  {
    code: '0301010048',
    name: 'Atendimento de profissionais de nível médio na atenção básica',
    complex: 'Atenção Básica',
    groupCode: '03',
    groupName: 'Procedimentos clínicos',
    tags: ['aps', 'consulta'],
  },
  {
    code: '0301100039',
    name: 'Atendimento de urgência em atenção básica',
    complex: 'Atenção Básica',
    groupCode: '03',
    groupName: 'Procedimentos clínicos',
    tags: ['aps', 'urgencia'],
  },
  // —— ABPG→SIGTAP (ProcedimentoDbEnum e-SUS; mapa piloto) ——
  {
    code: '0301100276',
    name: 'Curativo especial',
    complex: 'Atenção Básica',
    groupCode: '03',
    groupName: 'Procedimentos clínicos',
    tags: ['aps', 'abpg', 'ABPG007'],
  },
  {
    code: '0301100152',
    name: 'Retirada de pontos de cirurgias (por paciente)',
    complex: 'Atenção Básica',
    groupCode: '03',
    groupName: 'Procedimentos clínicos',
    tags: ['aps', 'abpg', 'ABPG018'],
  },
  {
    code: '0301100209',
    name: 'Administração de medicamentos por via intramuscular',
    complex: 'Atenção Básica',
    groupCode: '03',
    groupName: 'Procedimentos clínicos',
    tags: ['aps', 'abpg', 'ABPG028'],
  },
  {
    code: '0301100195',
    name: 'Administração de medicamentos por via endovenosa',
    complex: 'Atenção Básica',
    groupCode: '03',
    groupName: 'Procedimentos clínicos',
    tags: ['aps', 'abpg', 'ABPG029'],
  },
  {
    code: '0301100225',
    name: 'Administração de medicamentos por via subcutânea',
    complex: 'Atenção Básica',
    groupCode: '03',
    groupName: 'Procedimentos clínicos',
    tags: ['aps', 'abpg', 'ABPG041'],
  },
  {
    code: '0301040079',
    name: 'Consulta de enfermagem',
    complex: 'Atenção Básica',
    groupCode: '03',
    groupName: 'Procedimentos clínicos',
    tags: ['aps', 'enfermagem'],
  },
  {
    code: '0301060061',
    name: 'Acolhimento com classificação de risco',
    complex: 'Atenção Básica',
    groupCode: '03',
    groupName: 'Procedimentos clínicos',
    tags: ['aps', 'acolhimento'],
  },

  // —— Coletivo / educação / ACS ——
  {
    code: '0101010010',
    name: 'Atividade educativa / orientação em grupo',
    complex: 'Atenção Básica',
    groupCode: '01',
    groupName: 'Ações de promoção e prevenção',
    tags: ['coletivo'],
  },
  {
    code: '0101030019',
    name: 'Visita domiciliar por profissional de nível superior',
    complex: 'Atenção Básica',
    groupCode: '01',
    groupName: 'Ações de promoção e prevenção',
    tags: ['ad', 'acs'],
  },
  {
    code: '0101030027',
    name: 'Visita domiciliar por profissional de nível médio / ACS',
    complex: 'Atenção Básica',
    groupCode: '01',
    groupName: 'Ações de promoção e prevenção',
    tags: ['ad', 'acs'],
  },

  // —— Odontologia APS ——
  {
    code: '0101020029',
    name: 'Aplicação tópica de flúor',
    complex: 'Atenção Básica',
    groupCode: '01',
    groupName: 'Ações de promoção e prevenção',
    tags: ['odonto'],
  },
  {
    code: '0101020037',
    name: 'Evidenciamento de placa bacteriana',
    complex: 'Atenção Básica',
    groupCode: '01',
    groupName: 'Ações de promoção e prevenção',
    tags: ['odonto'],
  },
  {
    code: '0101020045',
    name: 'Selante de fóssulas e fissuras',
    complex: 'Atenção Básica',
    groupCode: '01',
    groupName: 'Ações de promoção e prevenção',
    tags: ['odonto'],
  },
  {
    code: '0101020061',
    name: 'Orientação de higiene bucal',
    complex: 'Atenção Básica',
    groupCode: '01',
    groupName: 'Ações de promoção e prevenção',
    tags: ['odonto'],
  },
  {
    code: '0307010015',
    name: 'Restauração de dente permanente anterior',
    complex: 'Atenção Básica',
    groupCode: '03',
    groupName: 'Procedimentos clínicos',
    tags: ['odonto'],
  },
  {
    code: '0307010031',
    name: 'Restauração de dente permanente posterior',
    complex: 'Atenção Básica',
    groupCode: '03',
    groupName: 'Procedimentos clínicos',
    tags: ['odonto'],
  },
  {
    code: '0307020025',
    name: 'Exodontia de dente permanente',
    complex: 'Atenção Básica',
    groupCode: '03',
    groupName: 'Procedimentos clínicos',
    tags: ['odonto'],
  },
  {
    code: '0301010153',
    name: '1ª consulta odontológica programada',
    complex: 'Atenção Básica',
    groupCode: '03',
    groupName: 'Procedimentos clínicos',
    tags: ['odonto', 'previne'],
  },
  {
    code: '0101020104',
    name: 'Orientação de higiene bucal',
    complex: 'Atenção Básica',
    groupCode: '01',
    groupName: 'Ações de promoção e prevenção',
    tags: ['odonto', 'previne'],
  },
  {
    code: '0101020074',
    name: 'Aplicação de flúor',
    complex: 'Atenção Básica',
    groupCode: '01',
    groupName: 'Ações de promoção e prevenção',
    tags: ['odonto', 'previne'],
  },
  {
    code: '0101020082',
    name: 'Evidenciação de placa bacteriana',
    complex: 'Atenção Básica',
    groupCode: '01',
    groupName: 'Ações de promoção e prevenção',
    tags: ['odonto', 'previne'],
  },
  {
    code: '0101020066',
    name: 'Selante de fóssulas e fissuras',
    complex: 'Atenção Básica',
    groupCode: '01',
    groupName: 'Ações de promoção e prevenção',
    tags: ['odonto', 'previne'],
  },
  {
    code: '0101020058',
    name: 'Aplicação de cariostático',
    complex: 'Atenção Básica',
    groupCode: '01',
    groupName: 'Ações de promoção e prevenção',
    tags: ['odonto', 'previne'],
  },
  {
    code: '0101020090',
    name: 'Selamento provisório de cavidade',
    complex: 'Atenção Básica',
    groupCode: '01',
    groupName: 'Ações de promoção e prevenção',
    tags: ['odonto'],
  },
  {
    code: '0307030040',
    name: 'Profilaxia / raspagem coronária',
    complex: 'Atenção Básica',
    groupCode: '03',
    groupName: 'Procedimentos clínicos',
    tags: ['odonto', 'previne'],
  },
  {
    code: '0307010074',
    name: 'Restauração atraumática (ART/TRA)',
    complex: 'Atenção Básica',
    groupCode: '03',
    groupName: 'Procedimentos clínicos',
    tags: ['odonto', 'previne'],
  },
  {
    code: '0307010120',
    name: 'Restauração de dente decíduo',
    complex: 'Atenção Básica',
    groupCode: '03',
    groupName: 'Procedimentos clínicos',
    tags: ['odonto', 'previne'],
  },
  {
    code: '0414020138',
    name: 'Exodontia de dente permanente',
    complex: 'Atenção Básica',
    groupCode: '04',
    groupName: 'Procedimentos cirúrgicos',
    tags: ['odonto', 'previne'],
  },
  {
    code: '0414020146',
    name: 'Exodontia de dente decíduo',
    complex: 'Atenção Básica',
    groupCode: '04',
    groupName: 'Procedimentos cirúrgicos',
    tags: ['odonto', 'previne'],
  },

  // —— Procedimentos / monitoramento APS ——
  {
    code: '0301100012',
    name: 'Aferição de pressão arterial',
    complex: 'Atenção Básica',
    groupCode: '03',
    groupName: 'Procedimentos clínicos',
    tags: ['procedimento', 'aps'],
  },
  {
    code: '0214010015',
    name: 'Eletrocardiograma',
    complex: 'Média Complexidade',
    groupCode: '02',
    groupName: 'Procedimentos com finalidade diagnóstica',
    tags: ['diagnostico'],
  },
  {
    code: '0211020036',
    name: 'Dosagem de glicose',
    complex: 'Média Complexidade',
    groupCode: '02',
    groupName: 'Procedimentos com finalidade diagnóstica',
    tags: ['diagnostico', 'lab'],
  },
  {
    code: '0202030080',
    name: 'Ultrassonografia de abdome total',
    complex: 'Média Complexidade',
    groupCode: '02',
    groupName: 'Procedimentos com finalidade diagnóstica',
    tags: ['diagnostico', 'regulacao'],
  },
  {
    code: '0205020023',
    name: 'Tomografia computadorizada de crânio',
    complex: 'Alta Complexidade',
    groupCode: '02',
    groupName: 'Procedimentos com finalidade diagnóstica',
    tags: ['diagnostico', 'regulacao'],
  },

  // —— Especialidades (gancho regulação / BPA futuro) ——
  {
    code: '0301010110',
    name: 'Consulta médica em atenção especializada',
    complex: 'Média Complexidade',
    groupCode: '03',
    groupName: 'Procedimentos clínicos',
    tags: ['regulacao', 'especializado'],
  },
  {
    code: '0301010129',
    name: 'Consulta médica em atenção especializada (retorno)',
    complex: 'Média Complexidade',
    groupCode: '03',
    groupName: 'Procedimentos clínicos',
    tags: ['regulacao', 'especializado'],
  },
];

/** Códigos BPA stub — devem existir no seed. */
export const SIGTAP_BPA_STUB_CODES = [
  '0301010064',
  '0301010030',
  '0101020010',
  '0101040024',
  '0101050011',
] as const;

export function sigtapSeedByTag(tag: string): SigtapSeedItem[] {
  return SIGTAP_SEED.filter((s) => s.tags?.includes(tag));
}
