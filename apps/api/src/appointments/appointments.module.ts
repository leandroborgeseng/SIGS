import { Module } from '@nestjs/common';
import { CareExtraModule } from '../care-extra/care-extra.module';
import { EncountersModule } from '../encounters/encounters.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [CareExtraModule, EncountersModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
