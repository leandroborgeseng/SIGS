export type DayGridSlot = {
  id: string;
  professionalId: string;
  startsAt: Date | string;
  endsAt: Date | string;
  status: string;
  itemType?: string | null;
  careLine?: string | null;
  professional?: { id: string; civilName: string; socialName?: string | null } | null;
  patient?: { id: string; civilName: string; socialName?: string | null } | null;
  dentalEncounter?: { id: string; status: string } | null;
  encounter?: { id: string; status: string } | null;
};

export type DayGridBand = {
  startsAt: string;
  endsAt: string;
  cells: Record<string, DayGridSlot[]>;
};

export function clampSlotMinutes(raw?: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 30;
  return Math.min(60, Math.max(15, Math.round(n)));
}

/** Grade horários × profissional. O slot entra na faixa que contém o início. */
export function buildDayGrid(opts: {
  from: Date;
  to: Date;
  slotMinutes?: number;
  slots: DayGridSlot[];
}): {
  from: string;
  to: string;
  slotMinutes: number;
  professionals: Array<{ id: string; civilName: string; socialName?: string | null }>;
  bands: DayGridBand[];
} {
  const slotMinutes = clampSlotMinutes(opts.slotMinutes);
  const fromMs = opts.from.getTime();
  const toMs = opts.to.getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) {
    return {
      from: opts.from.toISOString(),
      to: opts.to.toISOString(),
      slotMinutes,
      professionals: [],
      bands: [],
    };
  }

  const profMap = new Map<string, { id: string; civilName: string; socialName?: string | null }>();
  for (const slot of opts.slots) {
    if (profMap.has(slot.professionalId)) continue;
    if (slot.professional) {
      profMap.set(slot.professionalId, {
        id: slot.professional.id,
        civilName: slot.professional.civilName,
        socialName: slot.professional.socialName,
      });
    } else {
      profMap.set(slot.professionalId, { id: slot.professionalId, civilName: slot.professionalId });
    }
  }

  const step = slotMinutes * 60_000;
  const bands: DayGridBand[] = [];
  for (let t = fromMs; t < toMs; t += step) {
    const bandStart = t;
    const bandEnd = Math.min(t + step, toMs);
    const cells: Record<string, DayGridSlot[]> = {};
    for (const slot of opts.slots) {
      const start = new Date(slot.startsAt).getTime();
      if (start >= bandStart && start < bandEnd) {
        (cells[slot.professionalId] ||= []).push(slot);
      }
    }
    bands.push({
      startsAt: new Date(bandStart).toISOString(),
      endsAt: new Date(bandEnd).toISOString(),
      cells,
    });
  }

  return {
    from: opts.from.toISOString(),
    to: opts.to.toISOString(),
    slotMinutes,
    professionals: [...profMap.values()],
    bands,
  };
}
