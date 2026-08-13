import { Module } from '@nestjs/common';
import { ApsCatalogController, EncountersController } from './encounters.controller';
import { EncountersService } from './encounters.service';
import { ClinicalCoreModule } from '../clinical-core/clinical-core.module';

@Module({
  imports: [ClinicalCoreModule],
  controllers: [ApsCatalogController, EncountersController],
  providers: [EncountersService],
  exports: [EncountersService],
})
export class EncountersModule {}
