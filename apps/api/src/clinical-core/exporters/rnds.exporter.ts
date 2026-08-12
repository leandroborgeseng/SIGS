/**
 * A4 — contrato do exporter RNDS (stub).
 * LEDI/Siaps permanece o canal operacional até homologação.
 */
export type RndsExportRequest = {
  productionRecordIds: string[];
  /** ambiente futuro */
  target?: 'homolog' | 'prod';
};

export type RndsExportResponse = {
  status: 'not_implemented' | 'queued' | 'sent' | 'error';
  message: string;
  bundleId?: string;
  requestedIds: string[];
};

export function rndsExportStub(req: RndsExportRequest): RndsExportResponse {
  return {
    status: 'not_implemented',
    message: 'Exporter RNDS reservado — domínio Sigs* já está pronto para plugar o Bundle.',
    requestedIds: req.productionRecordIds || [],
  };
}
