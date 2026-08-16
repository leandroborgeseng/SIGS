import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PlatformModule } from './platform/platform.module';
import { OrganizationModule } from './organization/organization.module';
import { CnesModule } from './cnes/cnes.module';
import { PatientsModule } from './patients/patients.module';
import { TerritoryModule } from './territory/territory.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { EncountersModule } from './encounters/encounters.module';
import { VaccinationsModule } from './vaccinations/vaccinations.module';
import { ProductionModule } from './production/production.module';
import { ReportsModule } from './reports/reports.module';
import { CareExtraModule } from './care-extra/care-extra.module';
import { SigtapModule } from './sigtap/sigtap.module';
import { FaturamentoModule } from './faturamento/faturamento.module';
import { QueueModule } from './queue/queue.module';
import { PrescriptionsModule } from './prescriptions/prescriptions.module';
import { RegulationModule } from './regulation/regulation.module';
import { LediModule } from './ledi/ledi.module';
import { ClinicalCoreModule } from './clinical-core/clinical-core.module';
import { StorageModule } from './infra/storage/storage.module';
import { JobsModule } from './infra/jobs/jobs.module';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    JobsModule,
    AuthModule,
    PlatformModule,
    OrganizationModule,
    CnesModule,
    PatientsModule,
    TerritoryModule,
    AppointmentsModule,
    EncountersModule,
    VaccinationsModule,
    ProductionModule,
    FaturamentoModule,
    ReportsModule,
    CareExtraModule,
    SigtapModule,
    QueueModule,
    PrescriptionsModule,
    RegulationModule,
    LediModule,
    ClinicalCoreModule,
  ],
})
export class AppModule {}
