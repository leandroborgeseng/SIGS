import { Module } from '@nestjs/common';
import { CareExtraController } from './care-extra.controller';
import { CareExtraService } from './care-extra.service';
import { LediFaoBatchService } from './ledi-fao-batch.service';
import { LediZipChunkService } from './ledi-zip-chunk.service';

@Module({
  controllers: [CareExtraController],
  providers: [CareExtraService, LediFaoBatchService, LediZipChunkService],
  exports: [CareExtraService, LediFaoBatchService],
})
export class CareExtraModule {}
