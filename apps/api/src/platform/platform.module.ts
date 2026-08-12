import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { DemoSeedService } from './demo-seed.service';

@Module({
  controllers: [PlatformController],
  providers: [PlatformService, DemoSeedService],
})
export class PlatformModule {}
