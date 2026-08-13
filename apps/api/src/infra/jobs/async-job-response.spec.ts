/**
 * Contrato da UI: a última fatia ZIP devolve 202 + jobId.
 * A tela FAI/FAO faz poll em GET /v1/jobs/:id (e by-key se o 202 se perder).
 */
function extractJobId(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const jobId = (data as { jobId?: unknown }).jobId;
  if (typeof jobId === 'string' && jobId.length >= 8) return jobId;
  return null;
}

describe('contrato UI: resposta 202 do último chunk LEDI', () => {
  it('reconhece { async, jobId }', () => {
    expect(extractJobId({ async: true, jobId: 'job-chunk-1' })).toBe('job-chunk-1');
  });

  it('reconhece { jobId } sem async (proxy/Nest)', () => {
    expect(extractJobId({ jobId: 'job-chunk-1', status: 'queued' })).toBe('job-chunk-1');
  });

  it('não trata progresso de fatia como job', () => {
    expect(
      extractJobId({ complete: false, uploadId: '11111111-2222-4333-8444-555555555555', received: 1, total: 2 }),
    ).toBeNull();
  });
});
