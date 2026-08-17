/**
 * Catálogo mínimo de tipo de equipe CNES (códigos presentes no snapshot Franca 3516200).
 * Fonte: labels `teamTypeLabel` em `data/cnes/franca-3516200.json` (CnesWeb / Dados Abertos).
 * Códigos ausentes → fallback `Tipo N (sem catálogo)`.
 */
export const CNES_TEAM_TYPE_LABELS: Readonly<Record<string, string>> = {
  '22': 'EMAD I — Equipe Multiprofissional de Atenção Domiciliar I',
  '23': 'EMAP — Equipe Multidisciplinar de Apoio',
  '70': 'ESF — Equipe de Saúde da Família',
  '71': 'ESB — Equipe de Saúde Bucal',
  '72': 'eMulti — Equipe Multiprofissional na Atenção Primária à Saúde',
  '73': 'eCR — Equipe dos Consultórios na Rua',
  '74': 'eAPP — Equipe de Atenção Primária Prisional',
  '76': 'EAP — Equipe de Atenção Primária',
};

/** Label legível; nunca devolve só o código cru. */
export function resolveTeamTypeLabel(teamTypeId: string | null | undefined): string {
  const id = (teamTypeId || '').trim();
  if (!id) return 'Tipo não informado';
  const known = CNES_TEAM_TYPE_LABELS[id];
  if (known) return known;
  return `Tipo ${id} (sem catálogo)`;
}

export function listKnownTeamTypes(): Array<{ id: string; label: string }> {
  return Object.entries(CNES_TEAM_TYPE_LABELS)
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.id.localeCompare(b.id, 'pt-BR', { numeric: true }));
}
