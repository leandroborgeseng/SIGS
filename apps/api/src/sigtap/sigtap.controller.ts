import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SigtapService } from './sigtap.service';
import { ImportSigtapDto, ImportSigtapMsDto, ValidateSigtapDto } from './dto';
import { RequirePermissions } from '../auth/decorators';
import { PERMISSIONS } from '../auth/roles.seed';

const SIGTAP_UPLOAD = FileInterceptor('file', {
  limits: { fileSize: 40 * 1024 * 1024, fieldSize: 1024 * 1024, fields: 8, files: 1 },
});

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

  @Get('offline-status')
  offlineStatus() {
    return this.service.offlineStatus();
  }

  @Get('abpg-map')
  abpgMap() {
    return this.service.abpgMap();
  }

  @Post('import')
  @RequirePermissions(PERMISSIONS.PRODUCTION)
  importBatch(@Body() dto: ImportSigtapDto) {
    return this.service.importBatch(dto);
  }

  /** Importa TB_PROCEDIMENTO.txt (body JSON com content). */
  @Post('import-ms')
  @RequirePermissions(PERMISSIONS.PRODUCTION)
  importMs(@Body() dto: ImportSigtapMsDto) {
    return this.service.importMsProcedimento(dto);
  }

  /**
   * Upload multipart: ZIP oficial (TB_PROCEDIMENTO), TXT ou CSV.
   * Campo: file · opcional competencia (form field).
   */
  @Post('import-file')
  @RequirePermissions(PERMISSIONS.PRODUCTION)
  @UseInterceptors(SIGTAP_UPLOAD)
  importFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('competencia') competencia?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Envie o arquivo no campo multipart "file" (ZIP/TXT/CSV).');
    }
    return this.service.importMsUpload(
      { buffer: file.buffer, originalname: file.originalname },
      { competencia: competencia || undefined },
    );
  }

  /** Importa o arquivo já presente em data/sigtap/ (descoberta automática). */
  @Post('import-local')
  @RequirePermissions(PERMISSIONS.PRODUCTION)
  importLocal(@Query('competencia') competencia?: string, @Query('file') file?: string) {
    return this.service.importFromLocalPath({
      competencia: competencia || undefined,
      file: file || undefined,
    });
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
