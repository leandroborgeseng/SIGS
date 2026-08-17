import { resolveFatAuditHref } from './faturamento-audit.service';

describe('resolveFatAuditHref', () => {
  it('abre fila APS/odonto com encounterId', () => {
    expect(
      resolveFatAuditHref({ sourceType: 'encounter', sourceId: 'enc-1', fichaTipo: 'CONSULTA' }),
    ).toBe('/faturamento/aps?encounterId=enc-1');
    expect(
      resolveFatAuditHref({ sourceType: 'encounter', sourceId: 'enc-2', fichaTipo: 'FAO' }),
    ).toBe('/faturamento/odonto?encounterId=enc-2');
  });

  it('abre paciente a partir de production_record', () => {
    expect(
      resolveFatAuditHref({
        sourceType: 'production_record',
        sourceId: 'pr-1',
        patientId: 'pat-9',
        fichaTipo: 'FAI',
      }),
    ).toBe('/pacientes/pat-9');
  });

  it('abre wizard de lote com batchId', () => {
    expect(
      resolveFatAuditHref({
        sourceType: 'batch',
        sourceId: 'b-1',
        fichaTipo: 'individual_encounter',
      }),
    ).toBe('/faturamento/lote/fai?batchId=b-1');
  });
});
