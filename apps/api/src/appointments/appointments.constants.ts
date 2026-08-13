/** Tipos de item mínimos (RF-2.36 / RF-12.1) — não é o catálogo TR completo. */
export const APPOINTMENT_ITEM_TYPES = ['CONSULTA', 'ENCAIXE'] as const;
export type AppointmentItemType = (typeof APPOINTMENT_ITEM_TYPES)[number];

export const APPOINTMENT_CARE_LINES = ['GENERAL', 'ODONTO', 'APS'] as const;
export type AppointmentCareLine = (typeof APPOINTMENT_CARE_LINES)[number];

export const APPOINTMENT_ITEM_TYPE_CATALOG = [
  {
    id: 'CONSULTA' as const,
    label: 'Consulta agendada',
    tipoAtendimento: 2,
    description: 'Horário marcado — LEDI tipoAtendimento=2',
  },
  {
    id: 'ENCAIXE' as const,
    label: 'Encaixe / consulta no dia',
    tipoAtendimento: 5,
    description: 'Demanda do dia — LEDI tipoAtendimento=5',
  },
];

export function isAppointmentItemType(value: string | undefined | null): value is AppointmentItemType {
  return !!value && (APPOINTMENT_ITEM_TYPES as readonly string[]).includes(value);
}

export function isAppointmentCareLine(value: string | undefined | null): value is AppointmentCareLine {
  return !!value && (APPOINTMENT_CARE_LINES as readonly string[]).includes(value);
}

/** CONSULTA → 2 (agendada) · ENCAIXE → 5 (consulta no dia). Default 2. */
export function tipoAtendimentoFromItemType(itemType?: string | null): 2 | 5 {
  return itemType === 'ENCAIXE' ? 5 : 2;
}

export function parseCareLineFilter(raw?: string): string[] | undefined {
  if (!raw?.trim()) return undefined;
  const parts = raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => (APPOINTMENT_CARE_LINES as readonly string[]).includes(s));
  return parts.length ? parts : undefined;
}
