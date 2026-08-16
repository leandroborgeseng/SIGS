import { Module } from '@nestjs/common';
import { VaccinationsController } from './vaccinations.controller';
import { VaccinationsService } from './vaccinations.service';
import { ClinicalCoreModule } from '../clinical-core/clinical-core.module';

@Module({
  imports: [ClinicalCoreModule],
  controllers: [VaccinationsController],
  providers: [VaccinationsService],
})
export class VaccinationsModule {}
