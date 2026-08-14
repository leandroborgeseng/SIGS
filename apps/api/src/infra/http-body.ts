import type { INestApplication } from '@nestjs/common';
import {
  json,
  raw,
  urlencoded,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';

/** JSON/urlencoded — POST /batches (XMLs em JSON) e from-zip base64. Teto ≥ 2mb. */
export const HTTP_JSON_BODY_LIMIT = process.env.HTTP_BODY_LIMIT || '50mb';
/**
 * Raw parser só na rota de chunk ZIP (UI envia 512 KiB).
 * O teto do ZIP montado é 100 MB (`LEDI_ZIP_MAX_BYTES`) — não usar 100mb aqui,
 * senão um cliente poderia mandar o arquivo inteiro numa request e estourar RAM.
 */
export const HTTP_OCTET_CHUNK_LIMIT = process.env.HTTP_OCTET_CHUNK_LIMIT || '2mb';

export function isMultipartRequest(req: { headers?: { 'content-type'?: string } }): boolean {
  const ct = String(req.headers?.['content-type'] || '').toLowerCase();
  return ct.includes('multipart/form-data');
}

export function isRawOctetStream(req: { headers?: { 'content-type'?: string } }): boolean {
  const ct = String(req.headers?.['content-type'] || '').toLowerCase();
  return ct.includes('application/octet-stream');
}

export function isLediZipChunkRequest(req: {
  originalUrl?: string;
  url?: string;
  headers?: { 'content-type'?: string };
}): boolean {
  const url = String(req.originalUrl || req.url || '');
  if (url.includes('/dental/ledi/batches/upload-zip/chunk')) return true;
  return isRawOctetStream(req);
}

/**
 * json/urlencoded não podem tocar no stream multipart nem no octet-stream do
 * chunk ZIP — senão o multer/busboy vê EOF ou o JSON parser corrompe o binário.
 */
export function skipUnparsedBody(parser: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (isMultipartRequest(req) || isLediZipChunkRequest(req)) return next();
    return parser(req, res, next);
  };
}

/** Alias estável — testes e código antigo importam este nome. */
export const skipMultipart = skipUnparsedBody;

export function applyHttpBodyParsers(app: INestApplication, limit = HTTP_JSON_BODY_LIMIT) {
  app.use(skipUnparsedBody(json({ limit })));
  app.use(skipUnparsedBody(urlencoded({ extended: true, limit })));
  app.use(
    raw({
      type: (req) => isLediZipChunkRequest(req),
      limit: HTTP_OCTET_CHUNK_LIMIT,
    }),
  );
}
