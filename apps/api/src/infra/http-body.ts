import type { INestApplication } from '@nestjs/common';
import {
  json,
  urlencoded,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';

export const HTTP_JSON_BODY_LIMIT = process.env.HTTP_BODY_LIMIT || '50mb';

export function isMultipartRequest(req: { headers?: { 'content-type'?: string } }): boolean {
  const ct = String(req.headers?.['content-type'] || '').toLowerCase();
  return ct.includes('multipart/form-data');
}

/** json/urlencoded não podem tocar no stream multipart — senão o multer/busboy vê EOF. */
export function skipMultipart(parser: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (isMultipartRequest(req)) return next();
    return parser(req, res, next);
  };
}

export function applyHttpBodyParsers(app: INestApplication, limit = HTTP_JSON_BODY_LIMIT) {
  app.use(skipMultipart(json({ limit })));
  app.use(skipMultipart(urlencoded({ extended: true, limit })));
}
