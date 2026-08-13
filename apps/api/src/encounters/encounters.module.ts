import { Module } from '@nestjs/common';
import { ApsCatalogController, EncountersController } from './encounters.controller';
import { EncountersService } from './encounters.service';

@Module({
  controllers: [ApsCatalogController, EncountersController],
  providers: [EncountersService],
  exports: [EncountersService],
})
export class EncountersModule {}
