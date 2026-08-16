import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CnesController } from './cnes.controller';
import { CnesService } from './cnes.service';
import { CnesAuditService } from './cnes-audit.service';

@Module({
  imports: [PrismaModule],
  controllers: [CnesController],
  providers: [CnesService, CnesAuditService],
  exports: [CnesService, CnesAuditService],
})
export class CnesModule {}
