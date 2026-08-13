import {
  skipMultipart,
  isMultipartRequest,
  isLediZipChunkRequest,
  isRawOctetStream,
  HTTP_OCTET_CHUNK_LIMIT,
} from './http-body';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

describe('http-body multipart skip', () => {
  it('limite raw octet-stream da rota de chunk é ≥ 1mb', () => {
    const n = Number.parseInt(String(HTTP_OCTET_CHUNK_LIMIT), 10);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(String(HTTP_OCTET_CHUNK_LIMIT).toLowerCase()).toMatch(/mb$/);
  });

  it('detecta Content-Type multipart', () => {
    expect(
      isMultipartRequest({
        headers: { 'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary' },
      }),
    ).toBe(true);
    expect(isMultipartRequest({ headers: { 'content-type': 'application/json' } })).toBe(false);
  });

  it('detecta octet-stream e path de chunk ZIP', () => {
    expect(isRawOctetStream({ headers: { 'content-type': 'application/octet-stream' } })).toBe(true);
    expect(
      isLediZipChunkRequest({
        url: '/api/v1/dental/ledi/batches/upload-zip/chunk?uploadId=x',
        headers: { 'content-type': 'application/octet-stream' },
      }),
    ).toBe(true);
    expect(
      isLediZipChunkRequest({
        originalUrl: '/v1/dental/ledi/batches/upload-zip/chunk',
        headers: { 'content-type': 'text/plain' },
      }),
    ).toBe(true);
  });

  it('não chama json/urlencoded quando o pedido é multipart', () => {
    const parser = jest.fn() as unknown as RequestHandler;
    const mw = skipMultipart(parser);
    const next = jest.fn() as NextFunction;
    const req = {
      headers: { 'content-type': 'multipart/form-data; boundary=abc' },
    } as unknown as Request;
    mw(req, {} as Response, next);
    expect(parser).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('não chama json quando o pedido é chunk octet-stream', () => {
    const parser = jest.fn() as unknown as RequestHandler;
    const mw = skipMultipart(parser);
    const next = jest.fn() as NextFunction;
    const req = {
      url: '/api/v1/dental/ledi/batches/upload-zip/chunk',
      headers: { 'content-type': 'application/octet-stream' },
    } as unknown as Request;
    mw(req, {} as Response, next);
    expect(parser).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('delega JSON ao parser', () => {
    const parser = jest.fn((_req, _res, next: NextFunction) => next()) as unknown as RequestHandler;
    const mw = skipMultipart(parser);
    const next = jest.fn() as NextFunction;
    const req = { headers: { 'content-type': 'application/json' } } as unknown as Request;
    mw(req, {} as Response, next);
    expect(parser).toHaveBeenCalled();
  });
});
