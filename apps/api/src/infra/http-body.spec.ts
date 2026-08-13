import { skipMultipart, isMultipartRequest } from './http-body';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

describe('http-body multipart skip', () => {
  it('detecta Content-Type multipart', () => {
    expect(
      isMultipartRequest({
        headers: { 'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary' },
      }),
    ).toBe(true);
    expect(isMultipartRequest({ headers: { 'content-type': 'application/json' } })).toBe(false);
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

  it('delega JSON ao parser', () => {
    const parser = jest.fn((_req, _res, next: NextFunction) => next()) as unknown as RequestHandler;
    const mw = skipMultipart(parser);
    const next = jest.fn() as NextFunction;
    const req = { headers: { 'content-type': 'application/json' } } as unknown as Request;
    mw(req, {} as Response, next);
    expect(parser).toHaveBeenCalled();
  });
});
