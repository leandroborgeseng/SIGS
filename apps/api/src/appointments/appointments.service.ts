import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { APPOINTMENT_STATUS, AppointmentStatus, RF } from '../common/rf';
import { BookSlotDto, CreateSlotDto, UpdateSlotStatusDto } from './dto';

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(
    from?: string,
    to?: string,
    professionalId?: string,
    status?: string,
    facilityId?: string,
  ) {
    return this.prisma.appointmentSlot.findMany({
      where: {
        ...(facilityId ? { facilityId } : {}),
        ...(professionalId ? { professionalId } : {}),
        ...(status ? { status } : {}),
        ...(from || to
          ? {
              startsAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
        NOT: { status: 'DELETED' },
      },
      orderBy: { startsAt: 'asc' },
      include: { professional: true, patient: true, facility: true },
    });
  }

  async create(dto: CreateSlotDto) {
    if (!(await this.prisma.professional.findUnique({ where: { id: dto.professionalId } }))) {
      throw new BadRequestException('professionalId inválido');
    }
    if (dto.facilityId && !(await this.prisma.facility.findUnique({ where: { id: dto.facilityId } }))) {
      throw new BadRequestException('facilityId inválido');
    }
    if (dto.patientId && !(await this.prisma.patient.findUnique({ where: { id: dto.patientId } }))) {
      throw new BadRequestException('patientId inválido');
    }
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) throw new BadRequestException('endsAt deve ser após startsAt');

    const row = await this.prisma.appointmentSlot.create({
      data: {
        facilityId: dto.facilityId,
        professionalId: dto.professionalId,
        patientId: dto.patientId,
        startsAt,
        endsAt,
        notes: dto.notes,
        status: 'SCHEDULED',
      },
    });
    await this.prisma.audit('create', 'appointment_slot', row.id, [RF.AGENDA.id]);
    return row;
  }

  async book(id: string, dto: BookSlotDto) {
    const slot = await this.prisma.appointmentSlot.findUnique({ where: { id } });
    if (!slot || slot.status === 'DELETED') throw new NotFoundException('Slot não encontrado');
    if (slot.status !== 'SCHEDULED') {
      throw new BadRequestException('Só é possível agendar paciente em slot SCHEDULED');
    }
    if (!(await this.prisma.patient.findUnique({ where: { id: dto.patientId } }))) {
      throw new BadRequestException('patientId inválido');
    }
    const row = await this.prisma.appointmentSlot.update({
      where: { id },
      data: { patientId: dto.patientId },
    });
    await this.prisma.audit('book', 'appointment_slot', row.id, [RF.AGENDA.id], {
      patientId: dto.patientId,
    });
    return row;
  }

  async updateStatus(id: string, dto: UpdateSlotStatusDto) {
    const slot = await this.prisma.appointmentSlot.findUnique({ where: { id } });
    if (!slot || slot.status === 'DELETED') throw new NotFoundException('Slot não encontrado');
    if (!APPOINTMENT_STATUS.includes(dto.status as AppointmentStatus)) {
      throw new BadRequestException('status inválido');
    }
    if (dto.status === 'DELETED' && slot.status !== 'SCHEDULED') {
      throw new BadRequestException(
        'Exclusão permitida somente quando status atual é SCHEDULED (regra de design/negócio)',
      );
    }
    const row = await this.prisma.appointmentSlot.update({
      where: { id },
      data: { status: dto.status },
    });
    await this.prisma.audit('status', 'appointment_slot', row.id, [RF.AGENDA.id], {
      from: slot.status,
      to: dto.status,
    });
    return row;
  }

  /** Soft-delete via status DELETED — só se SCHEDULED. */
  async remove(id: string) {
    return this.updateStatus(id, { status: 'DELETED' });
  }
}
