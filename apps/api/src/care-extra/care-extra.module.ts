import { Module } from '@nestjs/common';
import { CareExtraController } from './care-extra.controller';
import { CareExtraService } from './care-extra.service';
import { LediFaoBatchService } from './ledi-fao-batch.service';

@Module({
  controllers: [CareExtraController],
  providers: [CareExtraService, LediFaoBatchService],
})
export class CareExtraModule {}
