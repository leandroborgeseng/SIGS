import { Global, Module, OnModuleInit } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { LediJobProcessors } from './ledi-job.processors';

@Global()
@Module({
  controllers: [JobsController],
  providers: [QueueService, JobsService, LediJobProcessors],
  exports: [QueueService, JobsService],
})
export class JobsModule implements OnModuleInit {
  constructor(private readonly processors: LediJobProcessors) {}

  onModuleInit() {
    this.processors.register();
  }
}
