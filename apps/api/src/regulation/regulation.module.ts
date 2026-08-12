import { Module } from '@nestjs/common';
import { RegulationController } from './regulation.controller';
import { RegulationService } from './regulation.service';

@Module({
  controllers: [RegulationController],
  providers: [RegulationService],
  exports: [RegulationService],
})
export class RegulationModule {}
