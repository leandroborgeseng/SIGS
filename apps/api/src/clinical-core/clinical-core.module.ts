import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ClinicalCoreService } from './clinical-core.service';
import { ClinicalCoreController } from './clinical-core.controller';

@Module({
  imports: [PrismaModule],
  providers: [ClinicalCoreService],
  controllers: [ClinicalCoreController],
  exports: [ClinicalCoreService],
})
export class ClinicalCoreModule {}
