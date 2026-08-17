/** Glossário da auditoria CNES — colunas, severidades e códigos de finding. */

export type FindingSeverity = 'error' | 'warn' | 'info';

export const SEVERITY_HELP: Record<
  FindingSeverity,
  { label: string; short: string; color: string }
> = {
  error: {
    label: 'Erro',
    short: 'Bloqueia ou invalida o cadastro — corrija antes de faturar/LEDI.',
    color: 'var(--danger, #b91c1c)',
  },
  warn: {
    label: 'Alerta',
    short: 'Inconsistência relevante: revise o vínculo CNES/INE ou o sync.',
    color: 'var(--warn, #b45309)',
  },
  info: {
    label: 'Info',
    short: 'Aviso informativo (ex.: unidade inativa sem equipe, ou equipe sem PF ainda).',
    color: 'var(--ink-3)',
  },
};

export const COLUMN_HELP: Array<{ col: string; meaning: string }> = [
  {
    col: 'Severidade',
    meaning: 'Erro (grave) · Alerta (revisar) · Info (contexto). Filtre pelo seletor acima.',
  },
  {
    col: 'Código',
    meaning: 'Identificador estável da regra (passe o mouse ou abra o glossário para o que fazer).',
  },
  {
    col: 'Mensagem',
    meaning: 'Resumo em português do problema encontrado nesta linha.',
  },
  {
    col: 'CNES',
    meaning:
      'Código Nacional de Estabelecimentos de Saúde (7 dígitos). Clique para abrir a unidade em /unidades.',
  },
  {
    col: 'INE',
    meaning:
      'Identificador Nacional de Equipe (10 dígitos). Clique para abrir a equipe em /equipes.',
  },
  {
    col: 'Entidade',
    meaning:
      'Tipo do registro no SIGS (facility = unidade, team = equipe, assignment = lotação) + id. Clique para o cadastro.',
  },
];

export type FindingCodeHelp = {
  title: string;
  meaning: string;
  action: string;
};

export const FINDING_CODE_HELP: Record<string, FindingCodeHelp> = {
  FACILITY_WITHOUT_TEAM: {
    title: 'Estabelecimento sem equipe',
    meaning:
      'A unidade (CNES) está no cadastro municipal, mas não tem nenhuma equipe (INE) vinculada.',
    action:
      'Confira se a unidade realmente não tem equipe no CNES; se tiver, rode o sync de rede. Estabelecimentos administrativos/sem equipe APS podem ficar assim — severidade Info se inativa.',
  },
  ASSIGNMENT_INE_MISSING: {
    title: 'Lotação com INE ausente/fora do snapshot',
    meaning:
      'Há lotação ativa (profissional × unidade) cuja equipe não tem INE, ou o INE não existe no snapshot CNES municipal.',
    action:
      'Abra a lotação; se CNES 9999999 / INE 0000000001, é seed de demonstração — ignore ou limpe o demo. Caso contrário, sincronize equipes + PF ou corrija o vínculo.',
  },
  TEAM_WITHOUT_MEMBERS: {
    title: 'Equipe sem profissionais lotados',
    meaning: 'Equipe ativa no SIGS sem nenhuma lotação PF ativa.',
    action:
      'Use «Importar profissionais lotados» ou abra /equipes e confira a composição. Sem membros, LEDI pode falhar por falta de CNS+CBO+INE.',
  },
  TEAM_WITHOUT_FACILITY: {
    title: 'Equipe sem estabelecimento',
    meaning: 'Equipe órfã ou ligada a unidade sem CNES.',
    action: 'Re-sincronize a rede municipal ou corrija o vínculo facility da equipe.',
  },
  INE_DUPLICATE: {
    title: 'INE duplicado',
    meaning: 'O mesmo INE aparece em mais de uma equipe no banco.',
    action: 'Inspecione as equipes listadas e remova/consolide o duplicado após sync.',
  },
  INE_CNES_OTHER_IBGE: {
    title: 'INE em CNES de outro município',
    meaning: 'A equipe aponta para um CNES cujo IBGE não é o município alvo (ou diverge do snapshot).',
    action: 'Verifique o vínculo equipe×unidade e o IBGE da facility.',
  },
  TEAM_FACILITY_TYPE_MISMATCH: {
    title: 'Tipo equipe × tipo unidade incompatível',
    meaning: 'Ex.: equipe APS (70–76) em consultório isolado (tipo 22).',
    action: 'Confira tipos no CNES; pode ser dado oficial atípico — trate como alerta de qualidade.',
  },
  SNAPSHOT_INACTIVE_SIGS_ACTIVE: {
    title: 'Inativo no snapshot, ativo no SIGS',
    meaning: 'CNES/INE desativado no arquivo CNES mas ainda ativo no SIGS.',
    action: 'Desative no SIGS ou aguarde próximo sync se o snapshot estiver desatualizado.',
  },
  CNES_FORMAT_INVALID: {
    title: 'CNES com formato inválido',
    meaning: 'CNES não tem 7 dígitos úteis (LEDI rejeita).',
    action: 'Corrija o cadastro da unidade.',
  },
  FACILITY_IBGE_MISMATCH: {
    title: 'IBGE da unidade ≠ município',
    meaning: 'A facility tem código IBGE diferente do município da auditoria.',
    action: 'Ajuste o IBGE em /unidades ou exclua do escopo municipal.',
  },
  PATIENT_TEAM_LINK_ORPHAN: {
    title: 'Vínculo paciente-equipe órfão',
    meaning: 'Paciente ligado a equipe inexistente ou inativa.',
    action: 'Reassocie o paciente a uma equipe ativa (sem PHI nesta tela).',
  },
  LEDI_CNES_INE_ALERT: {
    title: 'Produção recente com CNES/INE suspeito',
    meaning: 'Registro de produção (últimos 14 dias) com CNES inválido ou INE fora do snapshot.',
    action: 'Revise a lotação usada na ficha e a auditoria de faturamento.',
  },
};

export const DEMO_CNES = '9999999';
export const DEMO_INE = '0000000001';

export function isDemoSeed(cnes?: string | null, ine?: string | null): boolean {
  return cnes === DEMO_CNES || ine === DEMO_INE;
}

export function facilityHref(cnes?: string | null, facilityId?: string | null): string {
  if (cnes) return `/unidades?cnes=${encodeURIComponent(cnes)}`;
  if (facilityId) return `/unidades?id=${encodeURIComponent(facilityId)}`;
  return '/unidades';
}

export function teamHref(opts: {
  entityType?: string;
  entityId?: string | null;
  ine?: string | null;
}): string {
  if (opts.entityType === 'team' && opts.entityId) {
    return `/equipes/${encodeURIComponent(opts.entityId)}`;
  }
  if (opts.ine) return `/equipes?ine=${encodeURIComponent(opts.ine)}`;
  return '/equipes';
}

export function entityCadastroHref(f: {
  entityType: string;
  entityId?: string | null;
  cnes?: string | null;
  ine?: string | null;
  entityHref?: string | null;
}): string | null {
  if (f.entityHref) return f.entityHref;
  switch (f.entityType) {
    case 'facility':
      return facilityHref(f.cnes, f.entityId);
    case 'team':
      return teamHref(f);
    case 'assignment':
      return f.entityId
        ? `/lotacoes?assignmentId=${encodeURIComponent(f.entityId)}`
        : '/lotacoes';
    case 'patient_team_link':
      return f.ine ? `/equipes?ine=${encodeURIComponent(f.ine)}` : '/equipes';
    case 'production':
      return '/faturamento/auditoria';
    default:
      if (f.cnes) return facilityHref(f.cnes);
      if (f.ine) return teamHref({ ine: f.ine });
      return null;
  }
}
