import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RF } from '../common/rf';
import {
  AddFamilyMemberDto,
  CreateAcsHomeVisitDto,
  CreateHouseholdDto,
  CreateHouseholdFamilyDto,
  CreateMicroAreaDto,
  CreatePatientTeamLinkDto,
  UpdateAcsHomeVisitDto,
  UpdateFamilyMemberDto,
  UpdateHouseholdDto,
  UpdateHouseholdFamilyDto,
  UpdatePatientTeamLinkDto,
} from './dto';
import { householdCatalog, isValidPropertyType, isValidRelationship } from './household-catalog';
import {
  acsVisitCatalog,
  isValidAcsDesfecho,
  isValidAcsMotivo,
  isValidAcsShift,
  openStreetMapUrl,
} from './acs-visit-catalog';

const householdInclude = {
  team: { include: { facility: true } },
  microArea: true,
  families: {
    where: { active: true },
    include: {
      responsible: true,
      members: {
        where: { active: true },
        include: { patient: true },
      },
    },
  },
} as const;

@Injectable()
export class TerritoryService {
  constructor(private readonly prisma: PrismaService) {}

  catalogHousehold() {
    return householdCatalog();
  }

  catalogAcsVisit() {
    return acsVisitCatalog();
  }

  listMicroAreas(teamId?: string) {
    return this.prisma.microArea.findMany({
      where: teamId ? { teamId } : undefined,
      orderBy: [{ teamId: 'asc' }, { code: 'asc' }],
      include: {
        team: {
          include: { facility: true },
        },
      },
    });
  }

  async createMicroArea(dto: CreateMicroAreaDto) {
    const team = await this.prisma.team.findUnique({ where: { id: dto.teamId } });
    if (!team) throw new BadRequestException('teamId inválido');
    const row = await this.prisma.microArea.create({
      data: {
        teamId: dto.teamId,
        code: dto.code,
        name: dto.name,
        active: dto.active ?? true,
      },
      include: { team: { include: { facility: true } } },
    });
    await this.prisma.audit('create', 'micro_area', row.id, [RF.TERRITORY.id], { teamId: row.teamId });
    return row;
  }

  listLinks(patientId?: string, teamId?: string) {
    return this.prisma.patientTeamLink.findMany({
      where: {
        ...(patientId ? { patientId } : {}),
        ...(teamId ? { teamId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        patient: true,
        team: { include: { facility: true } },
        microArea: true,
      },
    });
  }

  async createLink(dto: CreatePatientTeamLinkDto) {
    if (!(await this.prisma.patient.findUnique({ where: { id: dto.patientId } }))) {
      throw new BadRequestException('patientId inválido');
    }
    if (!(await this.prisma.team.findUnique({ where: { id: dto.teamId } }))) {
      throw new BadRequestException('teamId inválido');
    }
    if (dto.microAreaId) {
      const ma = await this.prisma.microArea.findUnique({ where: { id: dto.microAreaId } });
      if (!ma) throw new BadRequestException('microAreaId inválido');
      if (ma.teamId !== dto.teamId) throw new BadRequestException('microárea não pertence à equipe');
    }
    const row = await this.prisma.patientTeamLink.create({
      data: {
        patientId: dto.patientId,
        teamId: dto.teamId,
        microAreaId: dto.microAreaId,
        active: dto.active ?? true,
      },
      include: {
        patient: true,
        team: { include: { facility: true } },
        microArea: true,
      },
    });
    await this.prisma.audit('create', 'patient_team_link', row.id, [
      RF.TERRITORY.id,
      RF.PATIENT_CDS.id,
    ]);
    return row;
  }

  async updateLink(id: string, dto: UpdatePatientTeamLinkDto) {
    const current = await this.prisma.patientTeamLink.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Vínculo não encontrado');

    if (dto.microAreaId) {
      const ma = await this.prisma.microArea.findUnique({ where: { id: dto.microAreaId } });
      if (!ma) throw new BadRequestException('microAreaId inválido');
      if (ma.teamId !== current.teamId) {
        throw new BadRequestException('microárea não pertence à equipe do vínculo');
      }
    }

    const row = await this.prisma.patientTeamLink.update({
      where: { id },
      data: {
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.microAreaId !== undefined ? { microAreaId: dto.microAreaId || null } : {}),
      },
      include: {
        patient: true,
        team: { include: { facility: true } },
        microArea: true,
      },
    });
    await this.prisma.audit(
      'update',
      'patient_team_link',
      id,
      [RF.TERRITORY.id, RF.PATIENT_CDS.id],
      { active: row.active },
    );
    return row;
  }

  async listHouseholds(opts: { teamId?: string; microAreaId?: string; patientId?: string }) {
    const { teamId, microAreaId, patientId } = opts;
    if (patientId) {
      const memberships = await this.prisma.familyMember.findMany({
        where: { patientId, active: true },
        select: { family: { select: { householdId: true } } },
      });
      const asResp = await this.prisma.householdFamily.findMany({
        where: { responsiblePatientId: patientId, active: true },
        select: { householdId: true },
      });
      const ids = [
        ...new Set([
          ...memberships.map((m) => m.family.householdId),
          ...asResp.map((f) => f.householdId),
        ]),
      ];
      if (!ids.length) return [];
      return this.prisma.household.findMany({
        where: {
          id: { in: ids },
          ...(teamId ? { teamId } : {}),
          ...(microAreaId ? { microAreaId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: householdInclude,
      });
    }
    return this.prisma.household.findMany({
      where: {
        ...(teamId ? { teamId } : {}),
        ...(microAreaId ? { microAreaId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: householdInclude,
    });
  }

  async getHousehold(id: string) {
    const row = await this.prisma.household.findUnique({
      where: { id },
      include: {
        ...householdInclude,
        families: {
          include: {
            responsible: true,
            members: { include: { patient: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Domicílio não encontrado');
    return row;
  }

  private async assertTeamAndMicro(teamId: string, microAreaId?: string | null) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new BadRequestException('teamId inválido');
    if (microAreaId) {
      const ma = await this.prisma.microArea.findUnique({ where: { id: microAreaId } });
      if (!ma) throw new BadRequestException('microAreaId inválido');
      if (ma.teamId !== teamId) throw new BadRequestException('microárea não pertence à equipe');
    }
  }

  private async assertPatient(id: string) {
    if (!(await this.prisma.patient.findUnique({ where: { id } }))) {
      throw new BadRequestException(`patientId inválido: ${id}`);
    }
  }

  private normalizeRelationship(r?: string) {
    const v = (r || 'OUTRO').toUpperCase();
    if (!isValidRelationship(v)) {
      throw new BadRequestException('relationship inválido (RESPONSAVEL|CONJUGE|FILHO|OUTRO)');
    }
    return v;
  }

  async createHousehold(dto: CreateHouseholdDto) {
    await this.assertTeamAndMicro(dto.teamId, dto.microAreaId);
    const propertyType = dto.propertyType ?? 1;
    if (!isValidPropertyType(propertyType)) {
      throw new BadRequestException('propertyType inválido (catálogo LEDI)');
    }
    if (dto.family) {
      await this.assertPatient(dto.family.responsiblePatientId);
      for (const m of dto.family.members || []) {
        await this.assertPatient(m.patientId);
        this.normalizeRelationship(m.relationship);
      }
    }

    const row = await this.prisma.household.create({
      data: {
        teamId: dto.teamId,
        microAreaId: dto.microAreaId,
        propertyType,
        street: dto.street,
        number: dto.number,
        complement: dto.complement,
        neighborhood: dto.neighborhood,
        city: dto.city,
        state: dto.state?.toUpperCase(),
        zip: dto.zip,
        municipalityIbge: dto.municipalityIbge,
        locationType: dto.locationType,
        dwellingType: dto.dwellingType,
        ownershipStatus: dto.ownershipStatus,
        waterSupply: dto.waterSupply,
        waterConsumption: dto.waterConsumption,
        sewageDisposal: dto.sewageDisposal,
        wasteDisposal: dto.wasteDisposal,
        electricity: dto.electricity,
        roomsCount: dto.roomsCount,
        residentsCount: dto.residentsCount,
        hasAnimals: dto.hasAnimals ?? false,
        animalsCount: dto.animalsCount,
        refusalTerm: dto.refusalTerm ?? false,
        active: dto.active ?? true,
        notes: dto.notes,
        ...(dto.family
          ? {
              families: {
                create: {
                  responsiblePatientId: dto.family.responsiblePatientId,
                  membersCount: dto.family.membersCount,
                  householdIncomeCode: dto.family.householdIncomeCode,
                  residingSince: dto.family.residingSince
                    ? new Date(dto.family.residingSince)
                    : undefined,
                  prontuarioNumber: dto.family.prontuarioNumber,
                  members: {
                    create: [
                      {
                        patientId: dto.family.responsiblePatientId,
                        relationship: 'RESPONSAVEL',
                      },
                      ...(dto.family.members || [])
                        .filter((m) => m.patientId !== dto.family!.responsiblePatientId)
                        .map((m) => ({
                          patientId: m.patientId,
                          relationship: this.normalizeRelationship(m.relationship),
                        })),
                    ],
                  },
                },
              },
            }
          : {}),
      },
      include: householdInclude,
    });
    await this.prisma.audit('create', 'household', row.id, [RF.TERRITORY.id], {
      teamId: row.teamId,
      propertyType: row.propertyType,
    });
    return row;
  }

  async updateHousehold(id: string, dto: UpdateHouseholdDto) {
    const current = await this.prisma.household.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Domicílio não encontrado');

    if (dto.microAreaId !== undefined && dto.microAreaId) {
      await this.assertTeamAndMicro(current.teamId, dto.microAreaId);
    }
    if (dto.propertyType !== undefined && !isValidPropertyType(dto.propertyType)) {
      throw new BadRequestException('propertyType inválido (catálogo LEDI)');
    }

    const row = await this.prisma.household.update({
      where: { id },
      data: {
        ...(dto.microAreaId !== undefined ? { microAreaId: dto.microAreaId || null } : {}),
        ...(dto.propertyType !== undefined ? { propertyType: dto.propertyType } : {}),
        ...(dto.street !== undefined ? { street: dto.street } : {}),
        ...(dto.number !== undefined ? { number: dto.number } : {}),
        ...(dto.complement !== undefined ? { complement: dto.complement } : {}),
        ...(dto.neighborhood !== undefined ? { neighborhood: dto.neighborhood } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.state !== undefined ? { state: dto.state?.toUpperCase() || null } : {}),
        ...(dto.zip !== undefined ? { zip: dto.zip } : {}),
        ...(dto.municipalityIbge !== undefined ? { municipalityIbge: dto.municipalityIbge } : {}),
        ...(dto.locationType !== undefined ? { locationType: dto.locationType } : {}),
        ...(dto.dwellingType !== undefined ? { dwellingType: dto.dwellingType } : {}),
        ...(dto.ownershipStatus !== undefined ? { ownershipStatus: dto.ownershipStatus } : {}),
        ...(dto.waterSupply !== undefined ? { waterSupply: dto.waterSupply } : {}),
        ...(dto.waterConsumption !== undefined ? { waterConsumption: dto.waterConsumption } : {}),
        ...(dto.sewageDisposal !== undefined ? { sewageDisposal: dto.sewageDisposal } : {}),
        ...(dto.wasteDisposal !== undefined ? { wasteDisposal: dto.wasteDisposal } : {}),
        ...(dto.electricity !== undefined ? { electricity: dto.electricity } : {}),
        ...(dto.roomsCount !== undefined ? { roomsCount: dto.roomsCount } : {}),
        ...(dto.residentsCount !== undefined ? { residentsCount: dto.residentsCount } : {}),
        ...(dto.hasAnimals !== undefined ? { hasAnimals: dto.hasAnimals } : {}),
        ...(dto.animalsCount !== undefined ? { animalsCount: dto.animalsCount } : {}),
        ...(dto.refusalTerm !== undefined ? { refusalTerm: dto.refusalTerm } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      include: householdInclude,
    });
    await this.prisma.audit('update', 'household', id, [RF.TERRITORY.id], { active: row.active });
    return row;
  }

  async createFamily(householdId: string, dto: CreateHouseholdFamilyDto) {
    const hh = await this.prisma.household.findUnique({ where: { id: householdId } });
    if (!hh) throw new NotFoundException('Domicílio não encontrado');
    await this.assertPatient(dto.responsiblePatientId);
    for (const m of dto.members || []) {
      await this.assertPatient(m.patientId);
      this.normalizeRelationship(m.relationship);
    }

    const row = await this.prisma.householdFamily.create({
      data: {
        householdId,
        responsiblePatientId: dto.responsiblePatientId,
        membersCount: dto.membersCount,
        householdIncomeCode: dto.householdIncomeCode,
        residingSince: dto.residingSince ? new Date(dto.residingSince) : undefined,
        prontuarioNumber: dto.prontuarioNumber,
        members: {
          create: [
            { patientId: dto.responsiblePatientId, relationship: 'RESPONSAVEL' },
            ...(dto.members || [])
              .filter((m) => m.patientId !== dto.responsiblePatientId)
              .map((m) => ({
                patientId: m.patientId,
                relationship: this.normalizeRelationship(m.relationship),
              })),
          ],
        },
      },
      include: {
        responsible: true,
        members: { include: { patient: true } },
        household: true,
      },
    });
    await this.prisma.audit('create', 'household_family', row.id, [RF.TERRITORY.id], {
      householdId,
    });
    return row;
  }

  async updateFamily(id: string, dto: UpdateHouseholdFamilyDto) {
    const current = await this.prisma.householdFamily.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Família não encontrada');
    if (dto.responsiblePatientId) await this.assertPatient(dto.responsiblePatientId);

    const row = await this.prisma.householdFamily.update({
      where: { id },
      data: {
        ...(dto.responsiblePatientId
          ? { responsiblePatientId: dto.responsiblePatientId }
          : {}),
        ...(dto.membersCount !== undefined ? { membersCount: dto.membersCount } : {}),
        ...(dto.householdIncomeCode !== undefined
          ? { householdIncomeCode: dto.householdIncomeCode }
          : {}),
        ...(dto.residingSince !== undefined
          ? { residingSince: dto.residingSince ? new Date(dto.residingSince) : null }
          : {}),
        ...(dto.prontuarioNumber !== undefined
          ? { prontuarioNumber: dto.prontuarioNumber }
          : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
      include: {
        responsible: true,
        members: { include: { patient: true } },
        household: true,
      },
    });
    await this.prisma.audit('update', 'household_family', id, [RF.TERRITORY.id], {
      active: row.active,
    });
    return row;
  }

  async addFamilyMember(familyId: string, dto: AddFamilyMemberDto) {
    const family = await this.prisma.householdFamily.findUnique({ where: { id: familyId } });
    if (!family) throw new NotFoundException('Família não encontrada');
    await this.assertPatient(dto.patientId);
    const relationship = this.normalizeRelationship(dto.relationship);

    const existing = await this.prisma.familyMember.findUnique({
      where: { familyId_patientId: { familyId, patientId: dto.patientId } },
    });
    if (existing) {
      const row = await this.prisma.familyMember.update({
        where: { id: existing.id },
        data: { active: true, relationship },
        include: { patient: true, family: true },
      });
      await this.prisma.audit('update', 'family_member', row.id, [RF.TERRITORY.id]);
      return row;
    }

    const row = await this.prisma.familyMember.create({
      data: { familyId, patientId: dto.patientId, relationship },
      include: { patient: true, family: true },
    });
    await this.prisma.audit('create', 'family_member', row.id, [RF.TERRITORY.id]);
    return row;
  }

  async updateFamilyMember(id: string, dto: UpdateFamilyMemberDto) {
    const current = await this.prisma.familyMember.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Membro não encontrado');
    const relationship =
      dto.relationship !== undefined ? this.normalizeRelationship(dto.relationship) : undefined;

    const row = await this.prisma.familyMember.update({
      where: { id },
      data: {
        ...(relationship ? { relationship } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
      include: { patient: true, family: true },
    });
    await this.prisma.audit('update', 'family_member', id, [RF.TERRITORY.id], {
      active: row.active,
    });
    return row;
  }

  private parseMotivosJson(raw: string): number[] {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.map(Number).filter((n) => Number.isFinite(n)) : [];
    } catch {
      return [];
    }
  }

  private decorateAcsVisit<T extends { motivosJson: string; latitude: number | null; longitude: number | null }>(
    row: T,
  ) {
    const motivos = this.parseMotivosJson(row.motivosJson);
    const hasGeo =
      row.latitude != null &&
      row.longitude != null &&
      Number.isFinite(row.latitude) &&
      Number.isFinite(row.longitude);
    return {
      ...row,
      motivos,
      mapUrl: hasGeo ? openStreetMapUrl(row.latitude as number, row.longitude as number) : null,
    };
  }

  private validateGeoPair(lat?: number | null, lon?: number | null) {
    const hasLat = lat != null && Number.isFinite(lat);
    const hasLon = lon != null && Number.isFinite(lon);
    if (hasLat !== hasLon) {
      throw new BadRequestException('Informe latitude e longitude juntos, ou nenhum dos dois');
    }
  }

  private normalizeMotivos(motivos: number[]): number[] {
    const unique = [...new Set(motivos.map(Number))];
    if (!unique.length) throw new BadRequestException('Informe ao menos um motivo de visita');
    for (const id of unique) {
      if (!isValidAcsMotivo(id)) throw new BadRequestException(`motivo inválido: ${id}`);
    }
    return unique;
  }

  private async assertAcsRefs(input: {
    facilityId: string;
    teamId?: string | null;
    microAreaId?: string | null;
    householdId?: string | null;
    patientId?: string | null;
    professionalId?: string | null;
  }) {
    if (!(await this.prisma.facility.findUnique({ where: { id: input.facilityId } }))) {
      throw new BadRequestException('facilityId inválido');
    }
    if (input.patientId) await this.assertPatient(input.patientId);
    if (input.professionalId) {
      if (!(await this.prisma.professional.findUnique({ where: { id: input.professionalId } }))) {
        throw new BadRequestException('professionalId inválido');
      }
    }
    let teamId = input.teamId ?? null;
    if (input.householdId) {
      const hh = await this.prisma.household.findUnique({ where: { id: input.householdId } });
      if (!hh) throw new BadRequestException('householdId inválido');
      if (!teamId) teamId = hh.teamId;
      else if (teamId !== hh.teamId) {
        throw new BadRequestException('householdId não pertence à equipe informada');
      }
    }
    if (teamId) {
      const team = await this.prisma.team.findUnique({ where: { id: teamId } });
      if (!team) throw new BadRequestException('teamId inválido');
      if (team.facilityId !== input.facilityId) {
        throw new BadRequestException('equipe não pertence à unidade');
      }
    }
    if (input.microAreaId) {
      const ma = await this.prisma.microArea.findUnique({ where: { id: input.microAreaId } });
      if (!ma) throw new BadRequestException('microAreaId inválido');
      if (teamId && ma.teamId !== teamId) {
        throw new BadRequestException('microárea não pertence à equipe');
      }
    }
    return teamId;
  }

  listAcsVisits(filters: {
    facilityId?: string;
    patientId?: string;
    householdId?: string;
    teamId?: string;
  }) {
    return this.prisma.acsHomeVisit
      .findMany({
        where: {
          ...(filters.facilityId ? { facilityId: filters.facilityId } : {}),
          ...(filters.patientId ? { patientId: filters.patientId } : {}),
          ...(filters.householdId ? { householdId: filters.householdId } : {}),
          ...(filters.teamId ? { teamId: filters.teamId } : {}),
          status: { not: 'VOID' },
        },
        orderBy: { visitedAt: 'desc' },
        include: {
          patient: true,
          household: true,
          team: true,
          microArea: true,
          professional: true,
          facility: true,
        },
        take: 200,
      })
      .then((rows) => rows.map((r) => this.decorateAcsVisit(r)));
  }

  async getAcsVisit(id: string) {
    const row = await this.prisma.acsHomeVisit.findUnique({
      where: { id },
      include: {
        patient: true,
        household: true,
        team: true,
        microArea: true,
        professional: true,
        facility: true,
      },
    });
    if (!row) throw new NotFoundException('Visita ACS não encontrada');
    return this.decorateAcsVisit(row);
  }

  async createAcsVisit(dto: CreateAcsHomeVisitDto) {
    if (!dto.patientId && !dto.householdId) {
      throw new BadRequestException('Informe patientId e/ou householdId');
    }
    if (!isValidAcsDesfecho(dto.desfecho)) {
      throw new BadRequestException('desfecho inválido');
    }
    const shift = (dto.shift || 'MANHA').toUpperCase();
    if (!isValidAcsShift(shift)) throw new BadRequestException('turno inválido');
    const motivos = this.normalizeMotivos(dto.motivos);
    this.validateGeoPair(dto.latitude, dto.longitude);

    const teamId = await this.assertAcsRefs({
      facilityId: dto.facilityId,
      teamId: dto.teamId,
      microAreaId: dto.microAreaId,
      householdId: dto.householdId,
      patientId: dto.patientId,
      professionalId: dto.professionalId,
    });

    const row = await this.prisma.acsHomeVisit.create({
      data: {
        facilityId: dto.facilityId,
        teamId: teamId ?? undefined,
        microAreaId: dto.microAreaId,
        householdId: dto.householdId,
        patientId: dto.patientId,
        professionalId: dto.professionalId,
        shift,
        desfecho: dto.desfecho,
        motivosJson: JSON.stringify(motivos),
        latitude: dto.latitude,
        longitude: dto.longitude,
        visitedAt: dto.visitedAt ? new Date(dto.visitedAt) : new Date(),
        notes: dto.notes,
      },
      include: {
        patient: true,
        household: true,
        team: true,
        microArea: true,
        professional: true,
        facility: true,
      },
    });
    await this.prisma.audit(
      'create',
      'acs_home_visit',
      row.id,
      [RF.ACS_VISIT.id, RF.ACS_VISIT_GEO.id],
      {
        desfecho: row.desfecho,
        hasGeo: row.latitude != null && row.longitude != null,
      },
    );
    return this.decorateAcsVisit(row);
  }

  async updateAcsVisit(id: string, dto: UpdateAcsHomeVisitDto) {
    const current = await this.prisma.acsHomeVisit.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Visita ACS não encontrada');

    const nextPatientId =
      dto.patientId !== undefined ? dto.patientId : current.patientId;
    const nextHouseholdId =
      dto.householdId !== undefined ? dto.householdId : current.householdId;
    if (!nextPatientId && !nextHouseholdId) {
      throw new BadRequestException('Informe patientId e/ou householdId');
    }

    const desfecho = dto.desfecho ?? current.desfecho;
    if (!isValidAcsDesfecho(desfecho)) throw new BadRequestException('desfecho inválido');

    const shift = (dto.shift ?? current.shift).toUpperCase();
    if (!isValidAcsShift(shift)) throw new BadRequestException('turno inválido');

    const motivos =
      dto.motivos !== undefined
        ? this.normalizeMotivos(dto.motivos)
        : this.parseMotivosJson(current.motivosJson);

    const latitude = dto.latitude !== undefined ? dto.latitude : current.latitude;
    const longitude = dto.longitude !== undefined ? dto.longitude : current.longitude;
    this.validateGeoPair(latitude, longitude);

    if (dto.status !== undefined && dto.status !== 'RECORDED' && dto.status !== 'VOID') {
      throw new BadRequestException('status inválido');
    }

    const teamId = await this.assertAcsRefs({
      facilityId: current.facilityId,
      teamId: dto.teamId !== undefined ? dto.teamId : current.teamId,
      microAreaId: dto.microAreaId !== undefined ? dto.microAreaId : current.microAreaId,
      householdId: nextHouseholdId,
      patientId: nextPatientId,
      professionalId:
        dto.professionalId !== undefined ? dto.professionalId : current.professionalId,
    });

    const row = await this.prisma.acsHomeVisit.update({
      where: { id },
      data: {
        teamId: teamId,
        microAreaId: dto.microAreaId !== undefined ? dto.microAreaId : undefined,
        householdId: dto.householdId !== undefined ? dto.householdId : undefined,
        patientId: dto.patientId !== undefined ? dto.patientId : undefined,
        professionalId: dto.professionalId !== undefined ? dto.professionalId : undefined,
        shift,
        desfecho,
        motivosJson: JSON.stringify(motivos),
        latitude,
        longitude,
        ...(dto.visitedAt ? { visitedAt: new Date(dto.visitedAt) } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: {
        patient: true,
        household: true,
        team: true,
        microArea: true,
        professional: true,
        facility: true,
      },
    });
    await this.prisma.audit(
      'update',
      'acs_home_visit',
      id,
      [RF.ACS_VISIT.id, RF.ACS_VISIT_GEO.id],
      { status: row.status, hasGeo: row.latitude != null },
    );
    return this.decorateAcsVisit(row);
  }
}
