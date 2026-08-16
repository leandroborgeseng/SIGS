'use client';

import { CdsLoteStubPage } from '@/app/faturamento/_components/CdsLoteStubPage';

export default function FaturamentoLoteAdStubPage() {
  return (
    <CdsLoteStubPage
      title="Lote Atenção Domiciliar"
      tipoCode={10}
      masterTag="fichaAtendimentoDomiciliarMasterTransport"
      nativeHref="/ad"
      nativeLabel="Atenção domiciliar"
      rf="RF-3.54"
    />
  );
}
