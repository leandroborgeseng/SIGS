'use client';

import { FaturamentoQueuePage } from '@/app/faturamento/_components/FaturamentoQueueScreen';

export default function FaturamentoOdontoPage() {
  return (
    <FaturamentoQueuePage
      config={{
        helpId: 'odonto.atendimento',
        title: 'Fila de faturamento odonto',
        description: 'Validação + produção do mês — mesmas cores do lote LEDI FAO',
        queuePath: '/faturamento/odonto',
        listEndpoint: '/v1/dental/faturamento-queue',
        syncEndpoint: '/v1/dental/faturamento-queue/sync',
        clinicalHref: '/odonto',
        clinicalLabel: 'Atendimentos',
        loteHref: '/faturamento/lote/fao',
        loteLabel: 'Lote XML / exportar ZIP',
        loteKindShort: 'FAO',
        newEncounterLabel: 'Novo atendimento',
      }}
    />
  );
}
