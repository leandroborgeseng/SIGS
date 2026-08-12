import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { ClinicalCoreService } from './clinical-core.service';

class NormalizeLediDto {
  @IsString() xml!: string;
}

class MigrateDryRunDto {
  @IsString() xml!: string;
  @IsOptional() @IsString() fileName?: string;
}

class MigratePersistDto {
  @IsString() xml!: string;
  @IsOptional() @IsString() fileName?: string;
  @IsOptional() @IsBoolean() force?: boolean;
}

class MatchDto {
  @IsString() leftPatientId!: string;
  @IsString() rightPatientId!: string;
}

class ResolveMatchDto {
  @IsIn(['accept', 'reject']) decision!: 'accept' | 'reject';
  @IsOptional() @IsString() winnerPatientId?: string;
}

@Controller('v1/clinical-core')
@UseGuards(AuthGuard('jwt'))
export class ClinicalCoreController {
  constructor(
    private readonly core: ClinicalCoreService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('normalize-ledi')
  normalize(@Body() dto: NormalizeLediDto) {
    const composition = this.core.normalizeLediXml(dto.xml);
    const engine = this.core.runRules({ xml: dto.xml, composition });
    return {
      composition: {
        fichaTipo: composition.fichaTipo,
        fichaTipoCode: composition.fichaTipoCode,
        uuidFicha: composition.uuidFicha,
        encounterCount: composition.encounters.length,
        patients: composition.encounters.map((e) => e.patient),
      },
      findings: engine.findings,
      audit: engine.audit,
      siapsReady: engine.siapsReady,
      previneReady: engine.previneReady,
    };
  }

  @Post('migrate-dry-run')
  migrateDryRun(@Body() dto: MigrateDryRunDto) {
    return this.core.migrateXmlDryRun(dto.xml, dto.fileName);
  }

  /** A2: importa XML histórico para ProductionRecord + Paciente Mestre. */
  @Post('migrate')
  migratePersist(@Body() dto: MigratePersistDto) {
    return this.core.migrateXmlPersist(dto.xml, { fileName: dto.fileName, force: dto.force });
  }

  @Post('match')
  async match(@Body() dto: MatchDto) {
    const [left, right] = await Promise.all([
      this.prisma.patient.findUniqueOrThrow({ where: { id: dto.leftPatientId } }),
      this.prisma.patient.findUniqueOrThrow({ where: { id: dto.rightPatientId } }),
    ]);
    return this.core.proposeMatch(
      {
        id: left.id,
        cpf: left.cpf,
        cns: left.cns,
        civilName: left.civilName,
        birthDate: left.birthDate?.toISOString().slice(0, 10),
        motherName: left.motherName,
      },
      {
        id: right.id,
        cpf: right.cpf,
        cns: right.cns,
        civilName: right.civilName,
        birthDate: right.birthDate?.toISOString().slice(0, 10),
        motherName: right.motherName,
      },
    );
  }

  @Get('match-queue')
  matchQueue(@Query('status') status?: string) {
    return this.core.listMatchQueue(status || 'pending_review');
  }

  @Post('match-queue/:id/resolve')
  resolveMatch(@Param('id') id: string, @Body() dto: ResolveMatchDto) {
    return this.core.resolveMatch(id, dto.decision, dto.winnerPatientId);
  }

  /** A4: contrato RNDS — ainda não envia. */
  @Post('export/rnds')
  exportRndsStub(@Body() body: { productionRecordIds?: string[] }) {
    return {
      status: 'not_implemented',
      message:
        'Exporter RNDS (Bundle FHIR) é fase A4 stub — use export LEDI/Siaps no lote. Contrato reservado.',
      requestedIds: body.productionRecordIds || [],
      next: 'Implementar Bundle R4 mínimo após homologação municipal.',
    };
  }
}
