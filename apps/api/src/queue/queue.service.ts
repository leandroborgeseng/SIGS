import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RF, ENCOUNTER_ACTIVE_QUEUE } from '../common/rf';
import { CallTicketDto, EmitTicketDto, FinishTicketDto, QUEUE_SERVICE_TYPES } from './dto';

const PREFIX: Record<string, string> = {
  NORMAL: 'N',
  PRIORITARIO: 'P',
  VACINA: 'V',
  ODONTO: 'O',
  OUTRO: 'X',
};

@Injectable()
export class QueueService {
  constructor(private readonly prisma: PrismaService) {}

  private startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  catalog() {
    return {
      serviceTypes: [
        { id: 'NORMAL', label: 'Atendimento comum', prefix: 'N' },
        { id: 'PRIORITARIO', label: 'Prioritário', prefix: 'P' },
        { id: 'VACINA', label: 'Vacinação', prefix: 'V' },
        { id: 'ODONTO', label: 'Odontologia', prefix: 'O' },
        { id: 'OUTRO', label: 'Outros serviços', prefix: 'X' },
      ],
      statuses: ['WAITING', 'CALLED', 'COMPLETED', 'NO_SHOW', 'CANCELLED'],
    };
  }

  async list(facilityId: string, status?: string) {
    if (!facilityId) throw new BadRequestException('facilityId obrigatório');
    return this.prisma.queueTicket.findMany({
      where: {
        facilityId,
        ...(status ? { status } : { createdAt: { gte: this.startOfToday() } }),
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      include: { patient: true, professional: true },
      take: 200,
    });
  }

  /** Visão do painel (público): última chamada + histórico recente + aguardando. */
  async panel(facilityId: string) {
    if (!facilityId) throw new BadRequestException('facilityId obrigatório');
    const facility = await this.prisma.facility.findUnique({ where: { id: facilityId } });
    if (!facility) throw new NotFoundException('Unidade não encontrada');

    const since = this.startOfToday();
    const [current, recent, waiting] = await Promise.all([
      this.prisma.queueTicket.findFirst({
        where: { facilityId, status: 'CALLED' },
        orderBy: { calledAt: 'desc' },
        include: { professional: true },
      }),
      this.prisma.queueTicket.findMany({
        where: { facilityId, status: { in: ['CALLED', 'COMPLETED'] }, createdAt: { gte: since } },
        orderBy: { calledAt: 'desc' },
        take: 8,
        include: { professional: true },
      }),
      this.prisma.queueTicket.count({
        where: { facilityId, status: 'WAITING', createdAt: { gte: since } },
      }),
    ]);

    return {
      facility: { id: facility.id, name: facility.name, cnes: facility.cnes },
      current,
      recent,
      waitingCount: waiting,
      rfIds: [RF.QUEUE_PANEL.id, RF.QUEUE_CALL.id],
      generatedAt: new Date().toISOString(),
    };
  }

  async emit(dto: EmitTicketDto) {
    if (!(await this.prisma.facility.findUnique({ where: { id: dto.facilityId } }))) {
      throw new BadRequestException('facilityId inválido');
    }
    if (!QUEUE_SERVICE_TYPES.includes(dto.serviceType)) {
      throw new BadRequestException('serviceType inválido');
    }
    if (dto.patientId) {
      const p = await this.prisma.patient.findUnique({ where: { id: dto.patientId } });
      if (!p) throw new BadRequestException('patientId inválido');
    }

    const since = this.startOfToday();
    const last = await this.prisma.queueTicket.findFirst({
      where: {
        facilityId: dto.facilityId,
        serviceType: dto.serviceType,
        createdAt: { gte: since },
      },
      orderBy: { seq: 'desc' },
    });
    const seq = (last?.seq || 0) + 1;
    const prefix = PREFIX[dto.serviceType] || 'X';
    const code = `${prefix}${String(seq).padStart(3, '0')}`;

    const row = await this.prisma.queueTicket.create({
      data: {
        facilityId: dto.facilityId,
        serviceType: dto.serviceType,
        code,
        seq,
        status: 'WAITING',
        patientId: dto.patientId,
        displayName: dto.displayName,
      },
      include: { patient: true, facility: true },
    });

    await this.prisma.audit('emit', 'queue_ticket', row.id, [RF.QUEUE_TOTEM.id], {
      code,
      serviceType: dto.serviceType,
      facilityId: dto.facilityId,
    });

    return row;
  }

  async call(id: string, dto: CallTicketDto) {
    const row = await this.prisma.queueTicket.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Senha não encontrada');
    if (row.status !== 'WAITING' && row.status !== 'CALLED') {
      throw new BadRequestException('Só é possível chamar senha WAITING ou reapresentar CALLED');
    }

    if (dto.professionalId) {
      const p = await this.prisma.professional.findUnique({ where: { id: dto.professionalId } });
      if (!p) throw new BadRequestException('professionalId inválido');
    }

    let encounterId = row.encounterId;
    if (dto.openEncounter && row.patientId && !encounterId) {
      const existing = await this.prisma.encounter.findFirst({
        where: {
          patientId: row.patientId,
          facilityId: row.facilityId,
          startedAt: { gte: this.startOfToday() },
          status: { in: [...ENCOUNTER_ACTIVE_QUEUE] },
        },
      });
      if (existing) {
        encounterId = existing.id;
      } else {
        const enc = await this.prisma.encounter.create({
          data: {
            patientId: row.patientId,
            facilityId: row.facilityId,
            professionalId: dto.professionalId,
            status: 'WAITING',
            careLocation: 'UBS',
            encounterType: row.serviceType === 'VACINA' ? 'VACINA' : 'CONSULTA',
          },
        });
        encounterId = enc.id;
      }
    }

    const updated = await this.prisma.queueTicket.update({
      where: { id },
      data: {
        status: 'CALLED',
        calledAt: new Date(),
        deskLabel: dto.deskLabel ?? row.deskLabel ?? 'Guichê 1',
        professionalId: dto.professionalId ?? row.professionalId,
        encounterId,
      },
      include: { patient: true, professional: true, facility: true },
    });

    await this.prisma.audit('call', 'queue_ticket', id, [RF.QUEUE_PANEL.id, RF.QUEUE_CALL.id], {
      code: updated.code,
      deskLabel: updated.deskLabel,
    });

    return updated;
  }

  async callNext(facilityId: string, dto: CallTicketDto) {
    const next = await this.prisma.queueTicket.findFirst({
      where: {
        facilityId,
        status: 'WAITING',
        createdAt: { gte: this.startOfToday() },
      },
      orderBy: [
        // prioritário primeiro
        { serviceType: 'asc' },
        { createdAt: 'asc' },
      ],
    });
    // Prefer PRIORITARIO: fetch them first
    const preferred = await this.prisma.queueTicket.findFirst({
      where: {
        facilityId,
        status: 'WAITING',
        serviceType: 'PRIORITARIO',
        createdAt: { gte: this.startOfToday() },
      },
      orderBy: { createdAt: 'asc' },
    });
    const target = preferred || next;
    if (!target) throw new NotFoundException('Nenhuma senha aguardando');
    return this.call(target.id, dto);
  }

  async finish(id: string, dto: FinishTicketDto) {
    const row = await this.prisma.queueTicket.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Senha não encontrada');
    if (!['WAITING', 'CALLED'].includes(row.status)) {
      throw new BadRequestException('Senha já finalizada');
    }
    const updated = await this.prisma.queueTicket.update({
      where: { id },
      data: { status: dto.status, finishedAt: new Date() },
    });
    await this.prisma.audit('finish', 'queue_ticket', id, [RF.QUEUE_CALL.id], { status: dto.status });
    return updated;
  }
}
