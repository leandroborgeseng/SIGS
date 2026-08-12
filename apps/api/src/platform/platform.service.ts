import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RF } from '../common/rf';

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  health() {
    return {
      status: 'ok',
      version: '0.3.0-dev',
      phase: 'rewrite-ui-fase2',
      ui: 'next-claude-design-mvp',
      stack: 'nestjs+prisma+next',
      database: 'sqlite',
    };
  }

  anchors() {
    return Object.values(RF).map((r) => ({
      id: r.id,
      tipo: r.tipo,
      fonte: r.fonte,
      teste_faturamento: r.teste_faturamento,
      nota: 'nota' in r ? r.nota : '',
    }));
  }

  async audit(limit = 100) {
    const rows = await this.prisma.auditEvent.findMany({
      orderBy: { at: 'desc' },
      take: limit,
    });
    return rows.map((e) => ({
      id: e.id,
      action: e.action,
      resourceType: e.resourceType,
      resourceId: e.resourceId,
      rfIds: e.rfIdsCsv ? e.rfIdsCsv.split(',') : [],
      detail: JSON.parse(e.detailJson || '{}'),
      at: e.at,
    }));
  }
}
