import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { getRequestContext } from '../infra/request-context';

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
    outcome: 'success' | 'failure' | 'partial' = 'success',
  ) {
    const ctx = getRequestContext();
    // Não gravar XML/CNS crus no detail — caller deve passar só metadados.
    const safeDetail = { ...detail };
    for (const k of Object.keys(safeDetail)) {
      if (/xml|cns|cpf|password|token/i.test(k) && typeof safeDetail[k] === 'string') {
        const v = String(safeDetail[k]);
        if (v.length > 32) safeDetail[k] = `[redacted:${v.length}chars]`;
      }
    }
    return this.auditEvent.create({
      data: {
        action,
        resourceType,
        resourceId,
        rfIdsCsv: rfIds.join(','),
        detailJson: JSON.stringify(safeDetail),
        userId: ctx?.userId,
        correlationId: ctx?.correlationId,
        ip: ctx?.ip,
        outcome,
      },
    });
  }
}
