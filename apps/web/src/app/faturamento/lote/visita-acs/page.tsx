'use client';

import { CdsLoteStubPage } from '@/app/faturamento/_components/CdsLoteStubPage';

export default function FaturamentoLoteVisitaAcsStubPage() {
  return (
    <CdsLoteStubPage
      title="Lote Visita ACS"
      tipoCode={8}
      masterTag="fichaVisitaDomiciliarMasterTransport"
      nativeHref="/territorio"
      nativeLabel="Território (Visitas ACS)"
      rf="RF-17.11"
    />
  );
}
