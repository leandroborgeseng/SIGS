/**
 * Catálogo LEDI (ids do e-SUS 5.5.24 / DbEnum) — reimplementação própria.
 * Fonte: model-5.5.24 (*DbEnum / LocalAtendimentoEnum / Sexo).
 * Aceita código amigável da UI e emite id numérico no payload.
 */

export type LediEnumEntry = {
  id: number;
  code: string;
  label: string;
  aliases?: string[];
};

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toUpperCase()
    .replace(/[\s/-]+/g, '_');
}

function index(entries: LediEnumEntry[]): Map<string, LediEnumEntry> {
  const map = new Map<string, LediEnumEntry>();
  for (const e of entries) {
    map.set(String(e.id), e);
    map.set(norm(e.code), e);
    map.set(norm(e.label), e);
    for (const a of e.aliases ?? []) map.set(norm(a), e);
  }
  return map;
}

export const LEDI_TURNO: LediEnumEntry[] = [
  { id: 1, code: 'MANHA', label: 'Manhã', aliases: ['MORNING', 'MATUTINO'] },
  { id: 2, code: 'TARDE', label: 'Tarde', aliases: ['AFTERNOON', 'VESPERTINO'] },
  { id: 3, code: 'NOITE', label: 'Noite', aliases: ['NIGHT', 'EVENING', 'NOTURNO'] },
];

export const LEDI_TIPO_ATENDIMENTO: LediEnumEntry[] = [
  {
    id: 1,
    code: 'CONSULTA_AGENDADA_PROGRAMADA',
    label: 'Consulta agendada programada / Cuidado continuado',
    aliases: ['CUIDADO_CONTINUADO', 'PROGRAMADA'],
  },
  {
    id: 2,
    code: 'CONSULTA_AGENDADA',
    label: 'Consulta agendada',
    aliases: ['CONSULTA', 'AGENDADA'],
  },
  { id: 3, code: 'DEMANDA_ESPONTANEA', label: 'Demanda espontânea', aliases: ['ESPONTANEA'] },
  {
    id: 4,
    code: 'ESCUTA_INICIAL',
    label: 'Escuta inicial / Orientação',
    aliases: ['ORIENTACAO', 'ESCUTA_INICIAL_ORIENTACAO'],
  },
  { id: 5, code: 'CONSULTA_NO_DIA', label: 'Consulta no dia', aliases: ['NO_DIA'] },
  {
    id: 6,
    code: 'ATENDIMENTO_URGENCIA',
    label: 'Atendimento de urgência',
    aliases: ['URGENCIA', 'ATENDIMENTO_DE_URGENCIA'],
  },
  { id: 7, code: 'ATENDIMENTO_PROGRAMADO', label: 'Atendimento programado' },
  { id: 8, code: 'ATENDIMENTO_NAO_PROGRAMADO', label: 'Atendimento não programado' },
  {
    id: 9,
    code: 'VISITA_DOMICILIAR_POS_OBITO',
    label: 'Visita domiciliar pós-óbito',
  },
];

/** TipoEncaminhamentoIndividualDbEnum — condutas/encaminhamentos da ficha AI */
export const LEDI_CONDUTA: LediEnumEntry[] = [
  {
    id: 1,
    code: 'RETORNO_CONSULTA_AGENDADA',
    label: 'Retorno para consulta agendada',
    aliases: ['RETORNO', 'RETORNO_AGENDADO'],
  },
  {
    id: 2,
    code: 'RETORNO_CUIDADO_CONTINUADO',
    label: 'Retorno para cuidado continuado / programado',
    aliases: ['CUIDADO_CONTINUADO'],
  },
  { id: 3, code: 'AGENDAMENTO_NASF', label: 'Agendamento para NASF', aliases: ['NASF'] },
  {
    id: 4,
    code: 'ENCAMINHAMENTO_ESPECIALIZADO',
    label: 'Encaminhamento para serviço especializado',
    aliases: ['ESPECIALIZADO', 'ENCAMINHAMENTO'],
  },
  { id: 5, code: 'ENCAMINHAMENTO_CAPS', label: 'Encaminhamento para CAPS', aliases: ['CAPS'] },
  {
    id: 6,
    code: 'ENCAMINHAMENTO_INTERNACAO',
    label: 'Encaminhamento para internação hospitalar',
    aliases: ['INTERNACAO'],
  },
  {
    id: 7,
    code: 'ENCAMINHAMENTO_URGENCIA',
    label: 'Encaminhamento para urgência',
    aliases: ['URGENCIA'],
  },
  {
    id: 8,
    code: 'ENCAMINHAMENTO_AD',
    label: 'Encaminhamento para serviço de atenção domiciliar',
    aliases: ['AD', 'ATENCAO_DOMICILIAR'],
  },
  {
    id: 9,
    code: 'ALTA',
    label: 'Alta do episódio',
    aliases: ['ALTA_DO_EPISODIO', 'ALTA_EPISODIO'],
  },
  {
    id: 10,
    code: 'ENCAMINHAMENTO_INTERSETORIAL',
    label: 'Encaminhamento intersetorial',
    aliases: ['INTERSETORIAL'],
  },
  {
    id: 11,
    code: 'ENCAMINHAMENTO_INTERNO_DIA',
    label: 'Encaminhamento interno no dia',
    aliases: ['INTERNO'],
  },
  { id: 12, code: 'AGENDAMENTO_GRUPOS', label: 'Agendamento para grupos', aliases: ['GRUPOS'] },
  {
    id: 13,
    code: 'MANTER_OBSERVACAO',
    label: 'Manter em observação',
    aliases: ['OBSERVACAO'],
  },
  { id: 14, code: 'AGENDAMENTO_EMULTI', label: 'Agendamento para eMulti', aliases: ['EMULTI'] },
];

export const LEDI_LOCAL_ATENDIMENTO: LediEnumEntry[] = [
  { id: 1, code: 'UBS', label: 'UBS' },
  { id: 2, code: 'UNIDADE_MOVEL', label: 'Unidade móvel', aliases: ['MOVEL'] },
  { id: 3, code: 'RUA', label: 'Rua' },
  { id: 4, code: 'DOMICILIO', label: 'Domicílio', aliases: ['CASA', 'HOME'] },
  { id: 5, code: 'ESCOLA_CRECHE', label: 'Escola / Creche', aliases: ['ESCOLA', 'CRECHE'] },
  { id: 6, code: 'OUTROS', label: 'Outros', aliases: ['OUTRO'] },
  { id: 7, code: 'POLO', label: 'Polo (Academia da saúde)' },
  { id: 8, code: 'INSTITUICAO_ABRIGO', label: 'Instituição / Abrigo', aliases: ['ABRIGO'] },
  {
    id: 9,
    code: 'UNIDADE_PRISIONAL',
    label: 'Unidade prisional ou congêneres',
    aliases: ['PRISIONAL'],
  },
  {
    id: 10,
    code: 'UNIDADE_SOCIOEDUCATIVA',
    label: 'Unidade socioeducativa',
    aliases: ['SOCIOEDUCATIVA'],
  },
  { id: 11, code: 'HOSPITAL', label: 'Hospital' },
  { id: 12, code: 'UPA', label: 'Unidade de pronto atendimento', aliases: ['PRONTO_ATENDIMENTO'] },
  { id: 13, code: 'CACON_UNACON', label: 'CACON / UNACON' },
  {
    id: 14,
    code: 'HOSPITAL_SOS_URGENCIA',
    label: 'Hospital SOS urgência / Emergência',
  },
  { id: 15, code: 'HOSPITAL_SOS_DEMAIS', label: 'Hospital SOS demais setores' },
  { id: 16, code: 'UBSI', label: 'UBSI' },
  { id: 17, code: 'UBSI_FLUVIAL', label: 'UBSI Fluvial' },
  { id: 18, code: 'POLO_BASE_TIPO_I', label: 'Sede de Polo Base Tipo I' },
  { id: 19, code: 'CASAI', label: 'CASAI' },
];

export const LEDI_SEXO: LediEnumEntry[] = [
  { id: 0, code: 'M', label: 'Masculino', aliases: ['MASCULINO', 'MALE', 'MASC'] },
  { id: 1, code: 'F', label: 'Feminino', aliases: ['FEMININO', 'FEMALE', 'FEM'] },
  { id: 2, code: 'A', label: 'Ambos', aliases: ['AMBOS'] },
  { id: 3, code: 'N', label: 'Não Informado', aliases: ['NAO_INFORMADO', 'NI'] },
  { id: 4, code: 'I', label: 'Ignorado', aliases: ['IGNORADO'] },
  { id: 5, code: 'IN', label: 'Indeterminado', aliases: ['INDETERMINADO'] },
];

const IDX = {
  turno: index(LEDI_TURNO),
  tipo: index(LEDI_TIPO_ATENDIMENTO),
  conduta: index(LEDI_CONDUTA),
  local: index(LEDI_LOCAL_ATENDIMENTO),
  sexo: index(LEDI_SEXO),
};

export type ResolvedLediEnum = { id: number; code: string; label: string };

function resolveOne(
  map: Map<string, LediEnumEntry>,
  raw: string | number | null | undefined,
  field: string,
): ResolvedLediEnum | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const key = typeof raw === 'number' ? String(raw) : norm(String(raw));
  const hit = map.get(key);
  if (!hit) {
    throw new Error(`${field} inválido para LEDI: "${raw}"`);
  }
  return { id: hit.id, code: hit.code, label: hit.label };
}

export function resolveTurno(raw?: string | number | null): ResolvedLediEnum | null {
  return resolveOne(IDX.turno, raw, 'turno');
}

export function resolveTipoAtendimento(raw?: string | number | null): ResolvedLediEnum | null {
  return resolveOne(IDX.tipo, raw, 'tipoAtendimento');
}

export function resolveLocalAtendimento(raw?: string | number | null): ResolvedLediEnum | null {
  return resolveOne(IDX.local, raw, 'localDeAtendimento');
}

export function resolveSexo(raw?: string | number | null): ResolvedLediEnum | null {
  return resolveOne(IDX.sexo, raw, 'sexo');
}

export function resolveConduta(raw: string | number): ResolvedLediEnum {
  const r = resolveOne(IDX.conduta, raw, 'conduta');
  if (!r) throw new Error('conduta vazia');
  return r;
}

export function resolveCondutas(raw: Array<string | number>): ResolvedLediEnum[] {
  return raw.map(resolveConduta);
}

/** Condutas/encaminhamentos odonto (TipoEncaminhamentoOdontoDbEnum) */
export const LEDI_CONDUTA_ODONTO: LediEnumEntry[] = [
  { id: 17, code: 'ALTA', label: 'Alta do episódio', aliases: ['ALTA_DO_EPISODIO'] },
  { id: 16, code: 'RETORNO', label: 'Retorno para consulta agendada', aliases: ['RETORNO_CONSULTA'] },
  { id: 15, code: 'TRATAMENTO_CONCLUIDO', label: 'Tratamento concluído' },
  { id: 12, code: 'AGENDAMENTO_OUTROS_AB', label: 'Agendamento para outros profissionais AB' },
  { id: 14, code: 'AGENDAMENTO_GRUPOS', label: 'Agendamento para grupos', aliases: ['GRUPOS'] },
  { id: 18, code: 'AGENDAMENTO_EMULTI', label: 'Agendamento para eMulti', aliases: ['EMULTI'] },
  { id: 13, code: 'AGENDAMENTO_NASF', label: 'Agendamento para NASF', aliases: ['NASF'] },
  { id: 1, code: 'NECESSIDADES_ESPECIAIS', label: 'Atendimento a pacientes com necessidades especiais' },
  { id: 2, code: 'CIRURGIA_BMF', label: 'Cirurgia BMF' },
  { id: 3, code: 'ENDODONTIA', label: 'Endodontia' },
  { id: 11, code: 'OUTROS', label: 'Outros', aliases: ['ENCAMINHAMENTO'] },
  { id: 99, code: 'NAO_SE_APLICA', label: 'Não se aplica' },
];

export const LEDI_TIPO_CONSULTA_ODONTO: LediEnumEntry[] = [
  {
    id: 1,
    code: 'PRIMEIRA',
    label: 'Primeira consulta odontológica programática',
    aliases: ['PRIMEIRA_CONSULTA', 'CONSULTA', 'PROGRAMATICA'],
  },
  { id: 2, code: 'RETORNO', label: 'Consulta de retorno', aliases: ['CONSULTA_RETORNO'] },
  { id: 3, code: 'CONCLUSAO', label: 'Consulta de conclusão do tratamento' },
  { id: 4, code: 'MANUTENCAO', label: 'Consulta de manutenção' },
  { id: 99, code: 'NAO_SE_APLICA', label: 'Não se aplica' },
];

export const LEDI_AD_MODALIDADE: LediEnumEntry[] = [
  { id: 1, code: 'AD1', label: 'Modalidade AD 1' },
  { id: 2, code: 'AD2', label: 'Modalidade AD 2' },
  { id: 3, code: 'AD3', label: 'Modalidade AD 3' },
];

export const LEDI_AD_DESFECHO: LediEnumEntry[] = [
  { id: 1, code: 'ALTA_CLINICA', label: 'Alta clínica', aliases: ['ALTA'] },
  { id: 3, code: 'ALTA_ADMINISTRATIVA', label: 'Alta administrativa' },
  { id: 7, code: 'PERMANENCIA', label: 'Permanência', aliases: ['PERMANECE'] },
  { id: 2, code: 'AD1', label: 'Atenção Primária (AD1)' },
  { id: 4, code: 'URGENCIA', label: 'Serviço de urgência e emergência' },
  { id: 5, code: 'INTERNACAO', label: 'Serviço de internação hospitalar' },
  { id: 9, code: 'OBITO', label: 'Óbito' },
  { id: 6, code: 'SAIDA_OBITO', label: 'Saída por óbito / fim pós-óbito' },
  { id: 8, code: 'POS_OBITO', label: 'Acompanhamento pós-óbito' },
];

export const LEDI_ATIVIDADE_COLETIVA: LediEnumEntry[] = [
  { id: 1, code: 'REUNIAO', label: '01 - Reunião de equipe', aliases: ['REUNIAO_EQUIPE'] },
  { id: 2, code: 'REUNIAO_OUTRAS_EQUIPES', label: '02 - Reunião com outras equipes' },
  { id: 3, code: 'REUNIAO_INTERSETORIAL', label: '03 - Reunião intersetorial' },
  {
    id: 4,
    code: 'EDUCACAO_SAUDE',
    label: '04 - Educação em saúde',
    aliases: ['EDUCACAO', 'EDUCACAO_EM_SAUDE'],
  },
  { id: 5, code: 'ATENDIMENTO_GRUPO', label: '05 - Atendimento em grupo' },
  { id: 6, code: 'AVALIACAO_PROCEDIMENTO', label: '06 - Avaliação / Procedimento coletivo' },
  { id: 7, code: 'MOBILIZACAO', label: '07 - Mobilização social', aliases: ['OUTRO'] },
];

export const LEDI_PUBLICO_ALVO: LediEnumEntry[] = [
  { id: 1, code: 'COMUNIDADE', label: 'Comunidade em geral', aliases: ['COMUNIDADE_EM_GERAL'] },
  { id: 2, code: 'CRIANCA_0_3', label: 'Criança 0 a 3 anos' },
  { id: 3, code: 'CRIANCA_4_5', label: 'Criança 4 a 5 anos' },
  { id: 4, code: 'CRIANCAS', label: 'Criança 6 a 11 anos', aliases: ['CRIANCA_6_11'] },
  { id: 5, code: 'ADOLESCENTE', label: 'Adolescente' },
  { id: 6, code: 'MULHER', label: 'Mulher' },
  { id: 7, code: 'GESTANTES', label: 'Gestante', aliases: ['GESTANTE'] },
  { id: 8, code: 'HOMEM', label: 'Homem' },
  { id: 9, code: 'FAMILIARES', label: 'Familiares' },
  { id: 10, code: 'IDOSOS', label: 'Pessoa idosa', aliases: ['IDOSO'] },
  {
    id: 12,
    code: 'HIPERTENSOS',
    label: 'Pessoas com doenças crônicas',
    aliases: ['CRONICOS', 'DIABETICOS'],
  },
  { id: 13, code: 'TABACO', label: 'Usuário de tabaco' },
  { id: 16, code: 'SAUDE_MENTAL', label: 'Sofrimento / transtorno mental' },
  {
    id: 17,
    code: 'PROFISSIONAIS',
    label: 'Profissional de educação',
    aliases: ['PROFISSIONAL_EDUCACAO'],
  },
  { id: 18, code: 'OUTROS', label: 'Outros' },
];

export const LEDI_TEMA_SAUDE: LediEnumEntry[] = [
  { id: 1, code: 'ALIMENTACAO', label: 'Alimentação saudável', aliases: ['ALIMENTACAO_SAUDAVEL'] },
  { id: 7, code: 'TABAGISMO', label: 'Prevenção álcool/tabaco/drogas', aliases: ['PNCT'] },
  { id: 15, code: 'SAUDE_BUCAL', label: 'Saúde bucal' },
  { id: 16, code: 'SAUDE_MENTAL', label: 'Saúde mental' },
  {
    id: 4,
    code: 'PREVENCAO',
    label: 'Autocuidado de pessoas com doenças crônicas',
    aliases: ['AUTOCUIDADO'],
  },
  { id: 21, code: 'OUTROS_TEMAS', label: 'Outros temas' },
];

export const LEDI_TEMA_REUNIAO: LediEnumEntry[] = [
  {
    id: 4,
    code: 'PLANEJAMENTO',
    label: 'Planejamento / Monitoramento das ações da equipe',
    aliases: ['PLANEJAMENTO_EQUIPE'],
  },
  { id: 1, code: 'ADMINISTRATIVO', label: 'Questões administrativas / Funcionamento' },
  { id: 2, code: 'PROCESSOS_TRABALHO', label: 'Processos de trabalho' },
  { id: 5, code: 'DISCUSSAO_CASO', label: 'Discussão de caso / PTS' },
  { id: 6, code: 'EDUCACAO_PERMANENTE', label: 'Educação permanente' },
  { id: 7, code: 'OUTROS', label: 'Outros' },
];

const IDX_EXTRA = {
  condutaOdonto: index(LEDI_CONDUTA_ODONTO),
  tipoConsultaOdonto: index(LEDI_TIPO_CONSULTA_ODONTO),
  adModalidade: index(LEDI_AD_MODALIDADE),
  adDesfecho: index(LEDI_AD_DESFECHO),
  atividadeColetiva: index(LEDI_ATIVIDADE_COLETIVA),
  publicoAlvo: index(LEDI_PUBLICO_ALVO),
  temaSaude: index(LEDI_TEMA_SAUDE),
  temaReuniao: index(LEDI_TEMA_REUNIAO),
};

export function resolveCondutaOdonto(raw: string | number): ResolvedLediEnum {
  const r = resolveOne(IDX_EXTRA.condutaOdonto, raw, 'condutaOdonto');
  if (!r) throw new Error('condutaOdonto vazia');
  return r;
}

export function resolveCondutasOdonto(raw: Array<string | number>): ResolvedLediEnum[] {
  return raw.map(resolveCondutaOdonto);
}

export function resolveTipoConsultaOdonto(raw?: string | number | null): ResolvedLediEnum | null {
  return resolveOne(IDX_EXTRA.tipoConsultaOdonto, raw, 'tipoConsultaOdonto');
}

export function resolveAdModalidade(raw?: string | number | null): ResolvedLediEnum | null {
  return resolveOne(IDX_EXTRA.adModalidade, raw, 'atencaoDomiciliarModalidade');
}

export function resolveAdDesfecho(raw?: string | number | null): ResolvedLediEnum | null {
  return resolveOne(IDX_EXTRA.adDesfecho, raw, 'condutaDesfecho');
}

export function resolveAtividadeColetiva(raw?: string | number | null): ResolvedLediEnum | null {
  return resolveOne(IDX_EXTRA.atividadeColetiva, raw, 'atividadeTipo');
}

export function resolvePublicoAlvo(raw?: string | number | null): ResolvedLediEnum | null {
  return resolveOne(IDX_EXTRA.publicoAlvo, raw, 'publicoAlvo');
}

export function resolveTemaSaude(raw?: string | number | null): ResolvedLediEnum | null {
  return resolveOne(IDX_EXTRA.temaSaude, raw, 'temaSaude');
}

export function resolveTemaReuniao(raw?: string | number | null): ResolvedLediEnum | null {
  return resolveOne(IDX_EXTRA.temaReuniao, raw, 'temaReuniao');
}

export function lediEnumCatalog() {
  return {
    version: 'esus-5.5.24-compatible',
    turno: LEDI_TURNO,
    tipoAtendimento: LEDI_TIPO_ATENDIMENTO,
    conduta: LEDI_CONDUTA,
    localAtendimento: LEDI_LOCAL_ATENDIMENTO,
    sexo: LEDI_SEXO,
    condutaOdonto: LEDI_CONDUTA_ODONTO,
    tipoConsultaOdonto: LEDI_TIPO_CONSULTA_ODONTO,
    adModalidade: LEDI_AD_MODALIDADE,
    adDesfecho: LEDI_AD_DESFECHO,
    atividadeColetiva: LEDI_ATIVIDADE_COLETIVA,
    publicoAlvo: LEDI_PUBLICO_ALVO,
    temaSaude: LEDI_TEMA_SAUDE,
    temaReuniao: LEDI_TEMA_REUNIAO,
  };
}
