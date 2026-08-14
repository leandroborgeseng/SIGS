import { extractLediChunkBytes, mergeLediChunkInput } from './ledi-chunk-body';

describe('extractLediChunkBytes / mergeLediChunkInput', () => {
  it('usa Buffer octet-stream', () => {
    const body = Buffer.from('PK\x03\x04');
    expect(extractLediChunkBytes({ body }).equals(body)).toBe(true);
  });

  it('decodifica JSON { data: base64 }', () => {
    const raw = Buffer.from('PK\x03\x04ABCD');
    const got = extractLediChunkBytes({ body: { data: raw.toString('base64') } });
    expect(got.equals(raw)).toBe(true);
  });

  it('JSON vazio → buffer vazio', () => {
    expect(extractLediChunkBytes({ body: { uploadId: 'x' } }).length).toBe(0);
  });

  it('preenche query a partir do JSON Safari', () => {
    const raw = Buffer.from([1, 2, 3]);
    const merged = mergeLediChunkInput(
      {
        body: {
          uploadId: '11111111-2222-4333-8444-555555555555',
          index: 0,
          total: 27,
          data: raw.toString('base64'),
          fileName: 'sistemas.zip',
          expectedTipo: 'FAI',
          totalBytes: 512 * 1024 * 27,
        },
      },
      {},
    );
    expect(merged.uploadId).toBe('11111111-2222-4333-8444-555555555555');
    expect(merged.index).toBe(0);
    expect(merged.total).toBe(27);
    expect(merged.body.equals(raw)).toBe(true);
    expect(merged.fileName).toBe('sistemas.zip');
    expect(merged.expectedTipo).toBe('FAI');
  });

  it('query tem prioridade sobre JSON', () => {
    const merged = mergeLediChunkInput(
      { body: { uploadId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', index: 9, data: 'YQ==' } },
      { uploadId: '11111111-2222-4333-8444-555555555555', index: 0, total: 2 },
    );
    expect(merged.uploadId).toBe('11111111-2222-4333-8444-555555555555');
    expect(merged.index).toBe(0);
    expect(merged.total).toBe(2);
  });
});
