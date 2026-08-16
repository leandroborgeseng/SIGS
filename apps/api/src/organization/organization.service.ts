import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RF } from '../common/rf';
import {
  CreateAssignmentDto,
  CreateFacilityDto,
  CreateProfessionalDto,
  CreateTeamDto,
  EndAssignmentDto,
  UpdateFacilityDto,
} from './dto';
import { assertIbgeCode } from '../ledi/ibge';
import {
  applyGestaoFilter,
  parseGestaoMode,
  PREFEITURA_FRANCA_CNPJ,
  PREFEITURA_MANTENEDORA_CNPJS,
  resolveCnpjFilter,
} from '../cnes/cnes.filter';
import { loadBundledSnapshot } from '../cnes/cnes.snapshot';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  displayName(civil: string, social?: string | null) {
    return social || civil;
  }

  /**
   * Lista unidades. Default `gestao=municipal` = rede Prefeitura (não cidade IBGE inteira).
   * `gestao=todos` = todos os CNES do IBGE. `cnpj=prefeitura|47970769000104` alinha ao mantenedor.
   */
  listFacilities(
    q?: string,
    active?: boolean,
    ibgeCode?: string,
    gestaoRaw?: string,
    cnpjRaw?: string,
  ) {
    const gestao = parseGestaoMode(gestaoRaw);
    const cnpj = resolveCnpjFilter(cnpjRaw);
    const and: Prisma.FacilityWhereInput[] = [];

    if (active !== undefined) and.push({ active });
    if (ibgeCode) and.push({ ibgeCode });
    if (q) and.push({ OR: [{ name: { contains: q } }, { cnes: { contains: q } }] });

    if (gestao === 'municipal' || (cnpj && PREFEITURA_MANTENEDORA_CNPJS.has(cnpj))) {
      and.push(this.municipalListScope(ibgeCode));
    } else if (cnpj) {
      and.push({ cnpj });
    }

    return this.prisma.facility.findMany({
      where: and.length ? { AND: and } : {},
      orderBy: { name: 'asc' },
      include: { _count: { select: { teams: true } } },
    });
  }

  /** Escopo rede Prefeitura: flag DB + fallback snapshot (CNES 1244) se nada marcado. */
  private municipalListScope(ibgeCode?: string): Prisma.FacilityWhereInput {
    const cnesFromSnapshot = this.municipalCnesFromSnapshot(ibgeCode);
    if (cnesFromSnapshot?.length) {
      return {
        OR: [{ municipalNetwork: true }, { cnes: { in: cnesFromSnapshot } }],
      };
    }
    if (ibgeCode === '3516200' || !ibgeCode) {
      return {
        OR: [{ municipalNetwork: true }, { cnpj: PREFEITURA_FRANCA_CNPJ }, { naturezaJuridica: '1244' }],
      };
    }
    return { municipalNetwork: true };
  }

  private municipalCnesFromSnapshot(ibgeCode?: string): string[] | null {
    const ibge = ibgeCode || '3516200';
    try {
      const { snapshot } = loadBundledSnapshot(ibge);
      const { snapshot: muni } = applyGestaoFilter(snapshot, 'municipal');
      return muni.establishments.map((e) => e.cnes);
    } catch {
      return null;
    }
  }

  async createFacility(dto: CreateFacilityDto) {
    let ibgeCode: string | null | undefined = dto.ibgeCode;
    try {
      ibgeCode = assertIbgeCode(dto.ibgeCode);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    const row = await this.prisma.facility.create({
      data: {
        cnes: dto.cnes,
        name: dto.name,
        active: dto.active ?? true,
        cnpj: dto.cnpj,
        typeId: dto.typeId,
        ibgeCode: ibgeCode ?? undefined,
      },
    });
    await this.prisma.audit('create', 'facility', row.id, [RF.FACILITY_LIST.id], { cnes: row.cnes });
    return row;
  }

  async updateFacility(id: string, dto: UpdateFacilityDto) {
    const existing = await this.prisma.facility.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Unidade não encontrada');
    let ibgeCode: string | null | undefined = undefined;
    if (dto.ibgeCode !== undefined) {
      try {
        ibgeCode = assertIbgeCode(dto.ibgeCode);
      } catch (e) {
        throw new BadRequestException((e as Error).message);
      }
    }
    const row = await this.prisma.facility.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.cnpj !== undefined ? { cnpj: dto.cnpj } : {}),
        ...(dto.typeId !== undefined ? { typeId: dto.typeId } : {}),
        ...(dto.ibgeCode !== undefined ? { ibgeCode } : {}),
      },
    });
    await this.prisma.audit('update', 'facility', id, [RF.FACILITY_LIST.id], {
      ibgeCode: row.ibgeCode,
    });
    return row;
  }

  async getFacility(id: string) {
    const row = await this.prisma.facility.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Unidade não encontrada');
    return row;
  }

  listProfessionals(q?: string) {
    return this.prisma.professional.findMany({
      where: q
        ? {
            OR: [
              { civilName: { contains: q } },
              { socialName: { contains: q } },
              { cpf: { contains: q } },
              { cns: { contains: q } },
            ],
          }
        : undefined,
      orderBy: { civilName: 'asc' },
    });
  }

  async createProfessional(dto: CreateProfessionalDto) {
    const row = await this.prisma.professional.create({ data: { ...dto } });
    await this.prisma.audit('create', 'professional', row.id, [RF.PROFESSIONAL.id]);
    return { ...row, displayName: this.displayName(row.civilName, row.socialName) };
  }

  listTeams(facilityId?: string) {
    return this.prisma.team.findMany({
      where: facilityId ? { facilityId } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async createTeam(dto: CreateTeamDto) {
    const facility = await this.prisma.facility.findUnique({ where: { id: dto.facilityId } });
    if (!facility) throw new BadRequestException('facilityId inválido');
    const row = await this.prisma.team.create({
      data: {
        facilityId: dto.facilityId,
        name: dto.name,
        teamTypeId: dto.teamTypeId,
        active: dto.active ?? true,
        ine: dto.ine,
      },
    });
    await this.prisma.audit('create', 'team', row.id, [RF.TEAM.id], { facilityId: row.facilityId });
    return row;
  }

  listAssignments(filters: { facilityId?: string; professionalId?: string; activeOnly?: boolean }) {
    return this.prisma.professionalAssignment.findMany({
      where: {
        ...(filters.facilityId ? { facilityId: filters.facilityId } : {}),
        ...(filters.professionalId ? { professionalId: filters.professionalId } : {}),
        ...(filters.activeOnly ? { active: true } : {}),
      },
      orderBy: { startedAt: 'desc' },
      include: {
        professional: true,
        facility: true,
        team: true,
      },
      take: 200,
    });
  }

  async createAssignment(dto: CreateAssignmentDto) {
    if (!(await this.prisma.professional.findUnique({ where: { id: dto.professionalId } }))) {
      throw new BadRequestException('professionalId inválido');
    }
    if (!(await this.prisma.facility.findUnique({ where: { id: dto.facilityId } }))) {
      throw new BadRequestException('facilityId inválido');
    }
    if (dto.teamId) {
      const team = await this.prisma.team.findUnique({ where: { id: dto.teamId } });
      if (!team) throw new BadRequestException('teamId inválido');
      if (team.facilityId !== dto.facilityId) {
        throw new BadRequestException('equipe não pertence à unidade');
      }
    }
    const cbo = dto.cbo.trim();
    if (!/^\d{4,6}$/.test(cbo)) throw new BadRequestException('cbo deve ter 4–6 dígitos');

    const row = await this.prisma.professionalAssignment.create({
      data: {
        professionalId: dto.professionalId,
        facilityId: dto.facilityId,
        teamId: dto.teamId,
        cbo,
        roleLabel: dto.roleLabel,
        startedAt: dto.startedAt ? new Date(dto.startedAt) : new Date(),
        active: true,
      },
      include: { professional: true, facility: true, team: true },
    });
    await this.prisma.audit(
      'create',
      'professional_assignment',
      row.id,
      [RF.PROFESSIONAL.id, RF.LOTATION.id],
      { facilityId: row.facilityId, cbo: row.cbo },
    );
    return row;
  }

  async endAssignment(id: string, dto: EndAssignmentDto = {}) {
    const row = await this.prisma.professionalAssignment.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Lotação não encontrada');
    if (!row.active) {
      return this.prisma.professionalAssignment.findUnique({
        where: { id },
        include: { professional: true, facility: true, team: true },
      });
    }
    const updated = await this.prisma.professionalAssignment.update({
      where: { id },
      data: {
        active: false,
        endedAt: dto.endedAt ? new Date(dto.endedAt) : new Date(),
      },
      include: { professional: true, facility: true, team: true },
    });
    await this.prisma.audit('end', 'professional_assignment', id, [RF.LOTATION.id]);
    return updated;
  }
}
