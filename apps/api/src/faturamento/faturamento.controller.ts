import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators';
import { PERMISSIONS } from '../auth/roles.seed';
import { FaturamentoAuditService } from './faturamento-audit.service';
import { FRANCA_IBGE } from '../cnes/cnes.snapshot';

@Controller('v1/faturamento')
export class FaturamentoController {
  constructor(private readonly auditService: FaturamentoAuditService) {}

  @Get('status')
  status() {
    return {
      audit: 'GET /v1/faturamento/audit?competencia=YYYY-MM&ibge=3516200&gestao=municipal',
      defaultIbge: FRANCA_IBGE,
      defaultGestao: 'municipal',
    };
  }

  /**
   * Cruza produção (batches / ProductionRecord / encounters) com cadastro CNES + SIGTAP.
   * Escopo default: rede municipal (Prefeitura). Use gestao=todos para cidade inteira.
   * Severidade: blocker = bloqueia envio; quality = qualidade / Previne.
   */
  @Get('audit')
  @RequirePermissions(PERMISSIONS.PRODUCTION)
  audit(
    @Query('competencia') competencia?: string,
    @Query('ibge') ibge?: string,
    @Query('gestao') gestao?: string,
  ) {
    const mode = gestao === 'todos' || gestao === 'all' ? 'todos' : 'municipal';
    return this.auditService.audit({ competencia, ibge, gestao: mode });
  }
}
