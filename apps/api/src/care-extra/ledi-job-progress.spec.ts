import {
  chartSnapshotFromSummary,
  countRecordToMap,
  lediAnalyzeChunkSize,
  lediAutofixChunkSize,
  lediAutofixIdempotencyKey,
  lediFichaProgressMessage,
  lediFichaProgressPct,
  mapToCountRecord,
  parseAutofixCheckpoint,
  parseLediFichaProgress,
} from './ledi-job-progress';

describe('ledi-job-progress (chunks / poll)', () => {
  it('mensagem e % para 1240 de 8149', () => {
    expect(lediFichaProgressMessage(1240, 8149, 'apply')).toBe('processando ficha 1240 de 8149');
    expect(lediFichaProgressMessage(1240, 8149, 'dry-run')).toBe('simulando ficha 1240 de 8149');
    expect(lediFichaProgressMessage(400, 8000, 'import')).toBe('analisando ficha 400 de 8000');
    expect(lediFichaProgressPct(1240, 8149)).toBe(15);
    expect(lediFichaProgressPct(8149, 8149)).toBe(100);
    expect(lediFichaProgressPct(0, 0)).toBe(100);
  });

  it('parse da mensagem do poll', () => {
    expect(parseLediFichaProgress('processando ficha 1240 de 8149 (15%)')).toEqual({
      processed: 1240,
      total: 8149,
    });
    expect(parseLediFichaProgress('analisando ficha 10 de 100')).toEqual({ processed: 10, total: 100 });
    expect(parseLediFichaProgress('lendo ZIP…')).toBeNull();
  });

  it('chunk size com piso/teto', () => {
    const prev = process.env.LEDI_AUTOFIX_CHUNK_SIZE;
    const prevImp = process.env.LEDI_IMPORT_ANALYZE_CHUNK;
    try {
      delete process.env.LEDI_AUTOFIX_CHUNK_SIZE;
      expect(lediAutofixChunkSize()).toBe(150);
      process.env.LEDI_AUTOFIX_CHUNK_SIZE = '200';
      expect(lediAutofixChunkSize()).toBe(200);
      process.env.LEDI_AUTOFIX_CHUNK_SIZE = '5';
      expect(lediAutofixChunkSize()).toBe(20);
      process.env.LEDI_AUTOFIX_CHUNK_SIZE = '9999';
      expect(lediAutofixChunkSize()).toBe(500);
      process.env.LEDI_IMPORT_ANALYZE_CHUNK = '100';
      expect(lediAnalyzeChunkSize()).toBe(100);
    } finally {
      if (prev == null) delete process.env.LEDI_AUTOFIX_CHUNK_SIZE;
      else process.env.LEDI_AUTOFIX_CHUNK_SIZE = prev;
      if (prevImp == null) delete process.env.LEDI_IMPORT_ANALYZE_CHUNK;
      else process.env.LEDI_IMPORT_ANALYZE_CHUNK = prevImp;
    }
  });

  it('idempotency key lote inteiro vs seleção', () => {
    expect(lediAutofixIdempotencyKey('batch-1', {})).toBe('ledi-auto-fix:batch-1');
    expect(lediAutofixIdempotencyKey('batch-1', { dryRun: true })).toBe('ledi-dry-run:batch-1');
    const a = lediAutofixIdempotencyKey('batch-1', { onlyItemIds: ['b', 'a'] });
    const b = lediAutofixIdempotencyKey('batch-1', { onlyItemIds: ['a', 'b'] });
    expect(a).toBe(b);
    expect(a).toMatch(/^ledi-auto-fix:batch-1:sel:[0-9a-f]{12}$/);
    expect(a).not.toBe(lediAutofixIdempotencyKey('batch-1', { onlyItemIds: ['a'] }));
    expect(lediAutofixIdempotencyKey('batch-1', { onlyCode: 'ST_NAO_POSSUI_CPF' })).toBe(
      'ledi-auto-fix:batch-1:code:ST_NAO_POSSUI_CPF',
    );
    expect(lediAutofixIdempotencyKey('batch-1', { dryRun: true, onlyCode: 'TURNO' })).toBe(
      'ledi-dry-run:batch-1:code:TURNO',
    );
  });

  it('checkpoint resume: Maps ↔ JSON', () => {
    const rec = mapToCountRecord(new Map([['ST_NAO_POSSUI_CPF', 10], ['TURNO', 3]]));
    expect(rec).toEqual({ ST_NAO_POSSUI_CPF: 10, TURNO: 3 });
    expect(countRecordToMap(rec).get('TURNO')).toBe(3);
    const parsed = parseAutofixCheckpoint({
      processed: 200,
      total: 8000,
      touched: 80,
      dryRun: true,
      beforeCodes: rec,
    });
    expect(parsed?.processed).toBe(200);
    expect(parsed?.total).toBe(8000);
    expect(parsed?.touched).toBe(80);
    expect(countRecordToMap(parsed?.beforeCodes).get('ST_NAO_POSSUI_CPF')).toBe(10);
    expect(parseAutofixCheckpoint(null)).toBeNull();
  });

  it('snapshot do summary para gráficos (sem R$)', () => {
    const snap = chartSnapshotFromSummary({
      total: 8149,
      siapsReady: 1000,
      withBlockers: 7000,
      withWarn: 100,
      readyForFinalSend: 200,
      autoFixableItems: 500,
      treatment: {
        current: {
          fichas: 8149,
          bloqueioEnvio: 7000,
          riscoFaturamento: 400,
          indicadores: 549,
          ideais: 200,
        },
      },
    });
    expect(snap.total).toBe(8149);
    expect(snap.siapsReady).toBe(1000);
    expect(snap.treatment?.current?.bloqueioEnvio).toBe(7000);
    expect(JSON.stringify(snap)).not.toMatch(/R\$|reais/i);
  });
});
