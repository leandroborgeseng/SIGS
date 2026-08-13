import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { assertBootEnv } from './infra/boot-env';
import { QueueService } from './infra/queue/queue.service';

/**
 * Processo worker independente — escala horizontal sem API.
 * Uso: `node dist/worker.main.js` com REDIS_URL.
 */
async function bootstrap() {
  assertBootEnv('worker');
  const log = new Logger('Worker');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const queue = app.get(QueueService);
  await queue.startWorkers();
  log.log('SIGS worker online');
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('SIGS worker falhou ao subir:', err instanceof Error ? err.message : err);
  process.exit(1);
});
