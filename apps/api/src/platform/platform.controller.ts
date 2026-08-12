import { Controller, Get, Post, Query } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { DemoSeedService } from './demo-seed.service';
import { Public, RequirePermissions } from '../auth/decorators';
import { PERMISSIONS } from '../auth/roles.seed';

@Controller()
export class PlatformController {
  constructor(
    private readonly service: PlatformService,
    private readonly demo: DemoSeedService,
  ) {}

  @Public()
  @Get('health')
  health() {
    return this.service.health();
  }

  @Public()
  @Get('ready')
  ready() {
    return this.service.readiness();
  }

  @Get('v1/rf/anchors')
  anchors() {
    return this.service.anchors();
  }

  @Get('v1/audit')
  @RequirePermissions(PERMISSIONS.AUDIT)
  audit(@Query('limit') limit?: string) {
    return this.service.audit(limit ? Number(limit) : 100);
  }

  /** Garante dados fictícios de piloto (idempotente). */
  @Post('v1/demo/seed')
  @RequirePermissions(PERMISSIONS.ALL)
  seedDemo() {
    return this.demo.ensureDemoSeeded();
  }
}
