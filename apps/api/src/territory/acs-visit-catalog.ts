/**
 * Catálogo visita ACS/ACE — códigos MotivoVisitaDbEnum / DesfechoDbEnum (e-SUS CDS).
 * Fonte: model-5.5.24 …/enums/visitadomiciliar/*.java — sem lote XML nesta fatia.
 */

export const ACS_VISIT_DESFECHOS = [
  { id: 1, code: 'VISITA_REALIZADA', label: 'Visita realizada' },
  { id: 2, code: 'VISITA_RECUSADA', label: 'Visita recusada' },
  { id: 3, code: 'AUSENTE', label: 'Ausente' },
] as const;

/** Subconjunto MVP + ids LEDI completos para validação */
export const ACS_VISIT_MOTIVOS = [
  { id: 1, label: 'Cadastramento / Atualização' },
  { id: 29, label: 'Visita periódica' },
  { id: 2, label: 'Consulta' },
  { id: 3, label: 'Exame' },
  { id: 4, label: 'Vacina' },
  { id: 30, label: 'Condicionalidades do Bolsa Família' },
  { id: 5, label: 'Gestante' },
  { id: 6, label: 'Puérpera' },
  { id: 7, label: 'Recém-nascido' },
  { id: 8, label: 'Criança' },
  { id: 9, label: 'Pessoa com desnutrição' },
  { id: 10, label: 'Pessoa em reabilitação ou com deficiência' },
  { id: 11, label: 'Pessoa com hipertensão' },
  { id: 12, label: 'Pessoa com diabetes' },
  { id: 13, label: 'Pessoa com asma' },
  { id: 14, label: 'Pessoa com DPOC / enfisema' },
  { id: 15, label: 'Pessoa com câncer' },
  { id: 16, label: 'Pessoa com outras doenças crônicas' },
  { id: 17, label: 'Pessoa com hanseníase' },
  { id: 18, label: 'Pessoa com tuberculose' },
  { id: 32, label: 'Sintomáticos respiratórios' },
  { id: 33, label: 'Tabagista' },
  { id: 19, label: 'Domiciliados / Acamados' },
  { id: 20, label: 'Condições de vulnerabilidade social' },
  { id: 21, label: 'Condicionalidades do Bolsa Família (acompanhamento)' },
  { id: 22, label: 'Saúde mental' },
  { id: 23, label: 'Usuário de álcool' },
  { id: 24, label: 'Usuário de outras drogas' },
  { id: 38, label: 'Pessoa idosa' },
  { id: 34, label: 'Ação educativa' },
  { id: 35, label: 'Imóvel com foco' },
  { id: 36, label: 'Ação mecânica' },
  { id: 37, label: 'Tratamento focal' },
  { id: 25, label: 'Egresso de internação' },
  { id: 27, label: 'Convite para atividades coletivas / campanha' },
  { id: 31, label: 'Orientação / Prevenção' },
  { id: 28, label: 'Outros' },
  { id: 26, label: 'Controle ambiental / vetorial' },
] as const;

export const ACS_VISIT_SHIFTS = [
  { id: 'MANHA', label: 'Manhã' },
  { id: 'TARDE', label: 'Tarde' },
  { id: 'NOITE', label: 'Noite' },
] as const;

const MOTIVO_IDS = new Set(ACS_VISIT_MOTIVOS.map((m) => m.id));
const DESFECHO_IDS = new Set(ACS_VISIT_DESFECHOS.map((d) => d.id));
const SHIFT_IDS = new Set(ACS_VISIT_SHIFTS.map((s) => s.id));

export function isValidAcsMotivo(id: number): boolean {
  return MOTIVO_IDS.has(id as (typeof ACS_VISIT_MOTIVOS)[number]['id']);
}

export function isValidAcsDesfecho(id: number): boolean {
  return DESFECHO_IDS.has(id as (typeof ACS_VISIT_DESFECHOS)[number]['id']);
}

export function isValidAcsShift(raw: string): boolean {
  return SHIFT_IDS.has(raw as (typeof ACS_VISIT_SHIFTS)[number]['id']);
}

export function acsVisitCatalog() {
  return {
    desfechos: ACS_VISIT_DESFECHOS,
    motivos: ACS_VISIT_MOTIVOS,
    shifts: ACS_VISIT_SHIFTS,
  };
}

/** Link externo OpenStreetMap (sem lib de mapa no projeto). */
export function openStreetMapUrl(lat: number, lon: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`;
}
