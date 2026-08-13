import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CareExtraService } from '../care-extra/care-extra.service';
import { EncountersService } from '../encounters/encounters.service';
import { PrismaService } from '../prisma/prisma.service';
import { APPOINTMENT_STATUS, AppointmentStatus, RF } from '../common/rf';
import {
  BookSlotDto,
  CreateSlotDto,
  OpenApsFromSlotDto,
  OpenDentalFromSlotDto,
  UpdateSlotStatusDto,
} from './dto';
import {
  APPOINTMENT_ITEM_TYPE_CATALOG,
  isAppointmentCareLine,
  isAppointmentItemType,
  parseCareLineFilter,
  tipoAtendimentoFromItemType,
} from './appointments.constants';
import { buildDayGrid, clampSlotMinutes } from './appointments.grid';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly careExtra: CareExtraService,
    private readonly encounters: EncountersService,
  ) {}

  catalog() {
    return {
      itemTypes: APPOINTMENT_ITEM_TYPE_CATALOG,
      careLines: [
        { id: 'GENERAL', label: 'Geral' },
        { id: 'ODONTO', label: 'Odontologia' },
        { id: 'APS', label: 'APS / FAI' },
      ],
    };
  }

  list(
    from?: string,
    to?: string,
    professionalId?: string,
    status?: string,
    facilityId?: string,
    careLine?: string,
    itemType?: string,
  ) {
    const careLines = parseCareLineFilter(careLine);
    const itemTypeFilter = isAppointmentItemType(itemType) ? itemType : undefined;
    return this.prisma.appointmentSlot.findMany({
      where: {
        ...(facilityId ? { facilityId } : {}),
        ...(professionalId ? { professionalId } : {}),
        ...(status ? { status } : {}),
        ...(careLines ? { careLine: { in: careLines } } : {}),
        ...(itemTypeFilter ? { itemType: itemTypeFilter } : {}),
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
      include: {
        professional: true,
        patient: true,
        facility: true,
        dentalEncounter: { select: { id: true, status: true } },
        encounter: { select: { id: true, status: true } },
      },
    });
  }

  async dayGrid(opts: {
    from?: string;
    to?: string;
    facilityId?: string;
    professionalId?: string;
    careLine?: string;
    itemType?: string;
    slotMinutes?: number;
  }) {
    if (!opts.from || !opts.to) {
      throw new BadRequestException('from e to são obrigatórios na grade do dia');
    }
    const from = new Date(opts.from);
    const to = new Date(opts.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      throw new BadRequestException('intervalo from/to inválido');
    }
    const slots = await this.list(
      opts.from,
      opts.to,
      opts.professionalId,
      undefined,
      opts.facilityId,
      opts.careLine,
      opts.itemType,
    );
    const grid = buildDayGrid({
      from,
      to,
      slotMinutes: clampSlotMinutes(opts.slotMinutes),
      slots,
    });
    return {
      ...this.catalog(),
      ...grid,
      slots,
    };
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

    const itemType = isAppointmentItemType(dto.itemType) ? dto.itemType : 'CONSULTA';
    const careLine = isAppointmentCareLine(dto.careLine) ? dto.careLine : 'GENERAL';

    const row = await this.prisma.appointmentSlot.create({
      data: {
        facilityId: dto.facilityId,
        professionalId: dto.professionalId,
        patientId: dto.patientId,
        startsAt,
        endsAt,
        notes: dto.notes,
        itemType,
        careLine,
        status: 'SCHEDULED',
      },
    });
    await this.prisma.audit('create', 'appointment_slot', row.id, [RF.AGENDA.id, RF.ODONTO.id], {
      notes: dto.notes,
      itemType,
      careLine,
      tipoAtendimento: tipoAtendimentoFromItemType(itemType),
    });
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

  /** RF-12.1 — abre ficha odonto a partir do slot. */
  openDental(id: string, dto: OpenDentalFromSlotDto) {
    return this.careExtra.openDentalFromAppointment(id, {
      assignmentId: dto.assignmentId,
      cbo: dto.cbo,
      anamnese: dto.anamnese,
      encounterType: dto.encounterType,
      procedures: dto.procedures,
    });
  }

  /** RF-3.5 / RF-12.1 — abre ficha APS (FAI) a partir do slot genérico. */
  openAps(id: string, dto: OpenApsFromSlotDto) {
    return this.encounters.openApsFromAppointment(id, {
      assignmentId: dto.assignmentId,
      cbo: dto.cbo,
    });
  }
}
