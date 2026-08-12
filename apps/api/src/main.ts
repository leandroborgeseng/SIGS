import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded, type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { AppModule } from './app.module';
import { requestContext } from './infra/request-context';
import { RequestContextUserInterceptor } from './infra/request-context.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // Upload LEDI grande: preferir multipart + jobs; 20mb cobre patch/JSON comuns.
  const bodyLimit = process.env.HTTP_BODY_LIMIT || '20mb';
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));

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
  console.log(`SIGS API em http://0.0.0.0:${port}/api`);
}

bootstrap();
