import { Controller, Get, Param } from '@nestjs/common';
import { JobsService } from './jobs.service';

@Controller('v1/jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  /** Recupera o job da última fatia ZIP se o POST 202 se perdeu (timeout/proxy). */
  @Get('by-key/:key')
  getByKey(@Param('key') key: string) {
    return this.jobs.getByIdempotencyKey(key);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.jobs.get(id);
  }
}
