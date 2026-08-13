import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { AppModule } from './app.module';
import { assertBootEnv } from './infra/boot-env';
import { applyHttpBodyParsers } from './infra/http-body';
import { requestContext } from './infra/request-context';
import { RequestContextUserInterceptor } from './infra/request-context.interceptor';

async function bootstrap() {
  assertBootEnv('api');

  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // JSON/urlencoded: fallback ZIP base64 e patches. Multipart ZIP usa multer (até 100 MB).
  // Chunk ZIP: octet-stream raw (~2mb por fatia de 512 KiB). skipUnparsedBody: JSON não pode consumir esses streams.
  applyHttpBodyParsers(app);

  app.use((req: Request, res: Response, next: NextFunction) => {
    const incoming =
      (req.headers['x-correlation-id'] as string) ||
      (req.headers['x-request-id'] as string) ||
      randomUUID();
    res.setHeader('x-correlation-id', incoming);
    res.setHeader('x-request-id', incoming);
    requestContext.run(
      {
        correlationId: incoming,
        requestId: incoming,
        ip: req.ip,
      },
      () => next(),
    );
  });

  app.setGlobalPrefix('api');
  app.useGlobalInterceptors(new RequestContextUserInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(
    `SIGS API online · http://0.0.0.0:${port}/api · health=/api/health · ready=/api/ready`,
  );
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('SIGS API falhou ao subir:', err instanceof Error ? err.message : err);
  process.exit(1);
});
