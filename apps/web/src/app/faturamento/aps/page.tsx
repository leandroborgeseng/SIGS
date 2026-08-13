'use client';

import { FaturamentoQueuePage } from '@/app/faturamento/_components/FaturamentoQueueScreen';

export default function FaturamentoApsPage() {
  return (
    <FaturamentoQueuePage
      config={{
        helpId: 'faturamento.fila-aps',
        title: 'Fila de faturamento APS',
        description: 'Validação + produção do mês — FAI tipo 4 (atendimento individual)',
        queuePath: '/faturamento/aps',
        listEndpoint: '/v1/encounters/faturamento-queue',
        syncEndpoint: '/v1/encounters/faturamento-queue/sync',
        clinicalHref: '/aps',
        clinicalLabel: 'Atendimentos APS',
        loteHref: '/faturamento/lote/fai',
        loteLabel: 'Lote XML / exportar ZIP',
        loteKindShort: 'FAI',
        newEncounterLabel: 'Novo atendimento APS',
      }}
    />
  );
}
