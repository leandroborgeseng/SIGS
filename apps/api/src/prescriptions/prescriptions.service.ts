import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RF } from '../common/rf';
import { MEDICATION_SEED } from './med-seed';
import { CreatePrescriptionDto, IssuePrescriptionDto, RECIPE_TYPES } from './dto';

@Injectable()
export class PrescriptionsService implements OnModuleInit {
  private readonly log = new Logger(PrescriptionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    if (process.env.SKIP_MED_SEED === '1') return;
    await this.ensureMedSeeded();
  }

  async ensureMedSeeded() {
    const count = await this.prisma.medication.count();
    if (count > 0) return { seeded: false, count };
    for (const m of MEDICATION_SEED) {
      await this.prisma.medication.create({
        data: {
          code: m.code,
          name: m.name,
          activePrinciple: m.activePrinciple,
          form: m.form,
          concentration: m.concentration,
          defaultRoute: m.defaultRoute,
          recipeType: m.recipeType,
          controlled: 'controlled' in m ? !!m.controlled : false,
          source: 'seed',
          active: true,
        },
      });
    }
    this.log.log(`Medications seed: ${MEDICATION_SEED.length}`);
    return { seeded: true, count: MEDICATION_SEED.length };
  }

  catalogParams() {
    return {
      recipeTypes: [
        { id: 'COMUM', label: 'Receita comum' },
        { id: 'ESPECIAL', label: 'Receita especial' },
        { id: 'CONTROLE', label: 'Controle especial / notificação' },
      ],
      routes: [
        { id: 'ORAL', label: 'Oral' },
        { id: 'IM', label: 'Intramuscular' },
        { id: 'IV', label: 'Intravenosa' },
        { id: 'SC', label: 'Subcutânea' },
        { id: 'TOPICA', label: 'Tópica' },
        { id: 'OUTRO', label: 'Outra' },
      ],
      rfIds: [RF.MED_PARAMS.id, RF.PRESCRIPTION.id],
    };
  }

  searchMedications(q?: string) {
    return this.prisma.medication.findMany({
      where: {
        active: true,
        ...(q
          ? {
              OR: [
                { code: { contains: q } },
                { name: { contains: q } },
                { activePrinciple: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      take: 100,
    });
  }

  list(filters: { patientId?: string; encounterId?: string; facilityId?: string; status?: string }) {
    return this.prisma.prescription.findMany({
      where: {
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
        ...(filters.encounterId ? { encounterId: filters.encounterId } : {}),
        ...(filters.facilityId ? { facilityId: filters.facilityId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        patient: true,
        professional: true,
        facility: true,
        items: { include: { medication: true } },
      },
      take: 100,
    });
  }

  async get(id: string) {
    const row = await this.prisma.prescription.findUnique({
      where: { id },
      include: {
        patient: true,
        professional: true,
        facility: true,
        encounter: true,
        items: { include: { medication: true } },
      },
    });
    if (!row) throw new NotFoundException('Prescrição não encontrada');
    return row;
  }

  async create(dto: CreatePrescriptionDto) {
    if (!(await this.prisma.patient.findUnique({ where: { id: dto.patientId } }))) {
      throw new BadRequestException('patientId inválido');
    }
    if (!(await this.prisma.facility.findUnique({ where: { id: dto.facilityId } }))) {
      throw new BadRequestException('facilityId inválido');
    }
    if (dto.professionalId) {
      const p = await this.prisma.professional.findUnique({ where: { id: dto.professionalId } });
      if (!p) throw new BadRequestException('professionalId inválido');
    }
    if (dto.encounterId) {
      const e = await this.prisma.encounter.findUnique({ where: { id: dto.encounterId } });
      if (!e) throw new BadRequestException('encounterId inválido');
      if (e.patientId !== dto.patientId) {
        throw new BadRequestException('encounter não pertence ao paciente');
      }
    }
    if (!dto.items?.length) throw new BadRequestException('informe ao menos um item');

    const recipeType = dto.recipeType || 'COMUM';
    if (!RECIPE_TYPES.includes(recipeType)) throw new BadRequestException('recipeType inválido');

    const prepared: Array<{
      medicationId: string | null;
      freeTextName: string | null;
      dose: string;
      frequency: string;
      duration: string | null;
      quantity: string | null;
      route: string | null;
      instructions: string | null;
      offCatalog: boolean;
    }> = [];

    let hasOffCatalog = false;
    let maxRecipe: (typeof RECIPE_TYPES)[number] = recipeType;

    for (const item of dto.items) {
      if (!item.medicationId && !item.freeTextName?.trim()) {
        throw new BadRequestException('cada item precisa de medicationId ou freeTextName');
      }
      let medicationId: string | null = null;
      let freeTextName: string | null = item.freeTextName?.trim() || null;
      let offCatalog = false;
      let route = item.route || null;

      if (item.medicationId) {
        const med = await this.prisma.medication.findUnique({ where: { id: item.medicationId } });
        if (!med || !med.active) throw new BadRequestException(`medicamento inválido: ${item.medicationId}`);
        medicationId = med.id;
        freeTextName = freeTextName || med.name;
        route = route || med.defaultRoute;
        if (med.recipeType === 'CONTROLE') maxRecipe = 'CONTROLE';
        else if (med.recipeType === 'ESPECIAL' && maxRecipe === 'COMUM') maxRecipe = 'ESPECIAL';
      } else {
        offCatalog = true;
        hasOffCatalog = true;
      }

      prepared.push({
        medicationId,
        freeTextName,
        dose: item.dose,
        frequency: item.frequency,
        duration: item.duration || null,
        quantity: item.quantity || null,
        route,
        instructions: item.instructions || null,
        offCatalog,
      });
    }

    const row = await this.prisma.prescription.create({
      data: {
        patientId: dto.patientId,
        facilityId: dto.facilityId,
        professionalId: dto.professionalId,
        encounterId: dto.encounterId,
        recipeType: dto.recipeType || maxRecipe,
        notes: dto.notes,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        hasOffCatalog,
        status: 'DRAFT',
        items: { create: prepared },
      },
      include: {
        patient: true,
        professional: true,
        facility: true,
        items: { include: { medication: true } },
      },
    });

    await this.prisma.audit('create', 'prescription', row.id, [RF.PRESCRIPTION.id, RF.MED_PARAMS.id], {
      itemCount: prepared.length,
      hasOffCatalog,
      recipeType: row.recipeType,
    });

    return row;
  }

  async issue(id: string, dto: IssuePrescriptionDto = {}) {
    const row = await this.get(id);
    if (row.status === 'ISSUED') throw new BadRequestException('Receita já emitida');
    if (row.status === 'CANCELLED') throw new BadRequestException('Receita cancelada');
    if (row.hasOffCatalog && !dto.forceOffCatalog) {
      throw new BadRequestException(
        'Prescrição contém medicamento fora do padrão municipal — confirme com forceOffCatalog=true',
      );
    }

    const validUntil =
      dto.validUntil
        ? new Date(dto.validUntil)
        : row.validUntil ||
          (() => {
            const d = new Date();
            d.setDate(d.getDate() + 30);
            return d;
          })();

    const updated = await this.prisma.prescription.update({
      where: { id },
      data: { status: 'ISSUED', issuedAt: new Date(), validUntil },
      include: {
        patient: true,
        professional: true,
        facility: true,
        items: { include: { medication: true } },
      },
    });

    await this.prisma.audit('issue', 'prescription', id, [RF.PRESCRIPTION.id, RF.PRESCRIPTION_EMIT.id], {
      recipeType: updated.recipeType,
      hasOffCatalog: updated.hasOffCatalog,
    });

    return updated;
  }

  async cancel(id: string) {
    const row = await this.get(id);
    if (row.status === 'CANCELLED') return row;
    const updated = await this.prisma.prescription.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: {
        patient: true,
        professional: true,
        facility: true,
        items: { include: { medication: true } },
      },
    });
    await this.prisma.audit('cancel', 'prescription', id, [RF.PRESCRIPTION.id]);
    return updated;
  }
}
