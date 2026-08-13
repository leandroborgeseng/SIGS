export const ENCOUNTER_STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  WAITING: { label: 'Aguardando', tone: 'off' },
  INITIAL_LISTENING: { label: 'Escuta inicial', tone: 'brand' },
  IN_PROGRESS: { label: 'Em atendimento', tone: 'brand' },
  WAITING_OBSERVATION: { label: 'Aguardando observação', tone: 'warn' },
  IN_OBSERVATION: { label: 'Em observação', tone: 'warn' },
  COMPLETED: { label: 'Realizado', tone: 'ok' },
  DID_NOT_WAIT: { label: 'Não aguardou', tone: 'off' },
  ABSCONDED: { label: 'Evadiu', tone: 'danger' },
};

export const APPOINTMENT_STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  SCHEDULED: { label: 'Agendado', tone: 'brand' },
  PRESENT: { label: 'Presente na unidade', tone: 'ok' },
  NO_SHOW: { label: 'Não compareceu', tone: 'warn' },
  DID_NOT_WAIT: { label: 'Não aguardou', tone: 'off' },
  CANCELLED: { label: 'Cancelado', tone: 'off' },
  COMPLETED: { label: 'Realizado', tone: 'ok' },
  DELETED: { label: 'Excluído', tone: 'danger' },
};

export const APPOINTMENT_ITEM_TYPE_LABEL: Record<string, { label: string; tone: string }> = {
  CONSULTA: { label: 'Consulta agendada', tone: 'brand' },
  ENCAIXE: { label: 'Encaixe', tone: 'warn' },
};

export function displayPatientName(p: { civilName: string; socialName?: string | null }) {
  if (p.socialName?.trim()) return `${p.socialName} (${p.civilName})`;
  return p.civilName;
}

export function formatDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('pt-BR');
}

export function formatDateTime(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function formatTime(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
