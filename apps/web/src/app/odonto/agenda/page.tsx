'use client';

import { AgendaDayPage } from '@/components/agenda/AgendaDayPage';

export default function OdontoAgendaPage() {
  return (
    <AgendaDayPage
      careLine="ODONTO"
      title="Agenda odontológica"
      helpId="odonto.agenda"
      eyebrow="RF-12.1"
      description="Grade do dia (horários × profissional) · consulta agendada (tipo 2) ou encaixe (tipo 5) · abrir ficha odonto."
      listHref="/odonto"
      listLabel="Atendimentos"
      openEndpoint="open-dental"
      encounterPath={(id) => `/odonto/${id}`}
    />
  );
}
