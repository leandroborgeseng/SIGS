import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { QueueService } from './infra/queue/queue.service';

/**
 * Processo worker independente — escala horizontal sem API.
 * Uso: `node dist/worker.main.js` com REDIS_URL.
 */
async function bootstrap() {
  const log = new Logger('Worker');
  if (!process.env.REDIS_URL) {
    log.error('REDIS_URL obrigatório para o worker');
    process.exit(1);
  }
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const queue = app.get(QueueService);
  await queue.startWorkers();
  log.log('SIGS worker online');
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
