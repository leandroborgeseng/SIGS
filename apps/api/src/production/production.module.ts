import { Module } from '@nestjs/common';
import { ProductionController } from './production.controller';
import { ProductionService } from './production.service';
import { SigtapModule } from '../sigtap/sigtap.module';

@Module({
  imports: [SigtapModule],
  controllers: [ProductionController],
  providers: [ProductionService],
})
export class ProductionModule {}
