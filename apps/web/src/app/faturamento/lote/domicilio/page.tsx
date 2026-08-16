'use client';

import { CdsLoteStubPage } from '@/app/faturamento/_components/CdsLoteStubPage';

export default function FaturamentoLoteDomicilioStubPage() {
  return (
    <CdsLoteStubPage
      title="Lote Cadastro Domiciliar"
      tipoCode={3}
      masterTag="cadastroDomiciliarTransport"
      nativeHref="/territorio"
      nativeLabel="Território (domicílios)"
      rf="RF-2.29"
    />
  );
}
