import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { SigtapService } from './sigtap.service';
import { ImportSigtapDto, ImportSigtapMsDto, ValidateSigtapDto } from './dto';
import { RequirePermissions } from '../auth/decorators';
import { PERMISSIONS } from '../auth/roles.seed';

@Controller('v1/sigtap')
export class SigtapController {
  constructor(private readonly service: SigtapService) {}

  @Get('procedures')
  search(@Query('q') q?: string, @Query('active') active?: string) {
    const activeOnly = active === undefined ? true : active === 'true';
    return this.service.search(q, activeOnly);
  }

  @Get('procedures/:code')
  get(@Param('code') code: string) {
    return this.service.getByCode(code);
  }

  @Post('import')
  @RequirePermissions(PERMISSIONS.PRODUCTION)
  importBatch(@Body() dto: ImportSigtapDto) {
    return this.service.importBatch(dto);
  }

  /** Importa TB_PROCEDIMENTO.txt do zip oficial SIGTAP (DATASUS). */
  @Post('import-ms')
  @RequirePermissions(PERMISSIONS.PRODUCTION)
  importMs(@Body() dto: ImportSigtapMsDto) {
    return this.service.importMsProcedimento(dto);
  }

  @Get('seed-catalog')
  seedCatalog() {
    return this.service.catalogSeed();
  }

  @Post('validate')
  validate(@Body() dto: ValidateSigtapDto) {
    return this.service.validateCodes(dto);
  }

  @Post('seed')
  @RequirePermissions(PERMISSIONS.ALL)
  seed(@Query('force') force?: string) {
    return this.service.ensureSeeded({
      force: force === '1' || force === 'true',
    });
  }
}
