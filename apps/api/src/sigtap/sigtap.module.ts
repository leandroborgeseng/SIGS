import { Module } from '@nestjs/common';
import { SigtapController } from './sigtap.controller';
import { SigtapService } from './sigtap.service';

@Module({
  controllers: [SigtapController],
  providers: [SigtapService],
  exports: [SigtapService],
})
export class SigtapModule {}
