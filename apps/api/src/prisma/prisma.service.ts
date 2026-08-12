import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async audit(
    action: string,
    resourceType: string,
    resourceId: string,
    rfIds: string[],
    detail: Record<string, unknown> = {},
  ) {
    return this.auditEvent.create({
      data: {
        action,
        resourceType,
        resourceId,
        rfIdsCsv: rfIds.join(','),
        detailJson: JSON.stringify(detail),
      },
    });
  }
}
