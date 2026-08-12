import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RF } from '../common/rf';
import { CreateMicroAreaDto, CreatePatientTeamLinkDto } from './dto';

@Injectable()
export class TerritoryService {
  constructor(private readonly prisma: PrismaService) {}

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
    await this.prisma.audit('create', 'patient_team_link', row.id, [RF.TERRITORY.id]);
    return row;
  }
}
