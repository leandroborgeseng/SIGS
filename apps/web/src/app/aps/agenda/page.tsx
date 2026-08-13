'use client';

import { AgendaDayPage } from '@/components/agenda/AgendaDayPage';

export default function ApsAgendaPage() {
  return (
    <AgendaDayPage
      careLine="APS"
      title="Agenda APS"
      helpId="aps.agenda"
      eyebrow="RF-3.5 · RF-12.1"
      description="Mesmo modelo de slot da odonto. Grade do dia · consulta agendada (tipo 2) ou encaixe (tipo 5) · abrir ficha FAI em /aps."
      listHref="/aps"
      listLabel="Atendimentos APS"
      openEndpoint="open-aps"
      encounterPath={(id) => `/aps/${id}`}
    />
  );
}
