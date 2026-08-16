import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SigtapModule } from '../sigtap/sigtap.module';
import { FaturamentoController } from './faturamento.controller';
import { FaturamentoAuditService } from './faturamento-audit.service';

@Module({
  imports: [PrismaModule, SigtapModule],
  controllers: [FaturamentoController],
  providers: [FaturamentoAuditService],
  exports: [FaturamentoAuditService],
})
export class FaturamentoModule {}
