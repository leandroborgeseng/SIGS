import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CnesController } from './cnes.controller';
import { CnesService } from './cnes.service';
import { CnesAuditService } from './cnes-audit.service';
import { CnesTeamsService } from './cnes-teams.service';

@Module({
  imports: [PrismaModule],
  controllers: [CnesController],
  providers: [CnesService, CnesAuditService, CnesTeamsService],
  exports: [CnesService, CnesAuditService, CnesTeamsService],
})
export class CnesModule {}
