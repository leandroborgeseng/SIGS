import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RF } from '../common/rf';
import { REGULATION_COMPLEX_SEED, REGULATION_PROCEDURE_SEED } from './reg-seed';
import {
  AuthorizeRegulationDto,
  ClassifyRegulationDto,
  CloseRegulationDto,
  CreateRegulationRequestDto,
  DenyRegulationDto,
  REGULATION_PRIORITIES,
  ReturnRegulationDto,
} from './dto';

const OPEN_STATUSES = ['SUBMITTED', 'CLASSIFIED', 'RETURNED'] as const;

@Injectable()
export class RegulationService implements OnModuleInit {
  private readonly log = new Logger(RegulationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    if (process.env.SKIP_REG_SEED === '1') return;
    await this.ensureSeeded();
  }

  async ensureSeeded() {
    const complexes = await this.prisma.regulationComplex.count();
    if (complexes === 0) {
      for (const c of REGULATION_COMPLEX_SEED) {
        await this.prisma.regulationComplex.create({ data: { ...c, active: true } });
      }
      this.log.log(`Regulation complexes seed: ${REGULATION_COMPLEX_SEED.length}`);
    }

    const procs = await this.prisma.regulationProcedure.count();
    if (procs === 0) {
      for (const p of REGULATION_PROCEDURE_SEED) {
        await this.prisma.regulationProcedure.create({
          data: {
            code: p.code,
            name: p.name,
            specialty: p.specialty,
            requiresCid: p.requiresCid,
            active: true,
            source: 'seed',
          },
        });
      }
      this.log.log(`Regulation procedures seed: ${REGULATION_PROCEDURE_SEED.length}`);
    }

    return {
      complexes: await this.prisma.regulationComplex.count(),
      procedures: await this.prisma.regulationProcedure.count(),
    };
  }

  async catalog() {
    await this.ensureSeeded();
    const [complexes, procedures] = await Promise.all([
      this.prisma.regulationComplex.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
      this.prisma.regulationProcedure.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    ]);
    return {
      complexes,
      procedures,
      priorities: REGULATION_PRIORITIES.map((id) => ({ id })),
      rfIds: [
        RF.REGULATION_COMPLEX.id,
        RF.REGULATION_PRE.id,
        RF.REGULATION_REQUEST.id,
        RF.REGULATION_QUEUE.id,
      ],
    };
  }

  include() {
    return {
      patient: true,
      facility: true,
      professional: true,
      encounter: true,
    } as const;
  }

  list(filters: {
    facilityId?: string;
    patientId?: string;
    encounterId?: string;
    status?: string;
    openOnly?: boolean;
  }) {
    return this.prisma.regulationRequest.findMany({
      where: {
        ...(filters.facilityId ? { facilityId: filters.facilityId } : {}),
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
        ...(filters.encounterId ? { encounterId: filters.encounterId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.openOnly ? { status: { in: [...OPEN_STATUSES] } } : {}),
      },
      orderBy: [{ createdAt: 'asc' }],
      include: this.include(),
      take: 200,
    });
  }

  async get(id: string) {
    const row = await this.prisma.regulationRequest.findUnique({
      where: { id },
      include: this.include(),
    });
    if (!row) throw new NotFoundException('Solicitação de regulação não encontrada');
    return row;
  }

  async create(dto: CreateRegulationRequestDto) {
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

    const code = dto.procedureCode.trim().toUpperCase();
    if (!code) throw new BadRequestException('procedureCode obrigatório');

    const catalogProc = await this.prisma.regulationProcedure.findUnique({ where: { code } });
    const offProtocol = !catalogProc || !catalogProc.active;
    const procedureName = dto.procedureName?.trim() || catalogProc?.name || code;

    if (catalogProc?.requiresCid && !dto.cid?.trim()) {
      throw new BadRequestException(`Procedimento ${code} exige CID no protocolo municipal`);
    }

    const priority = dto.priority || 'ELETIVO';
    if (!REGULATION_PRIORITIES.includes(priority)) {
      throw new BadRequestException('priority inválida');
    }

    const submit = dto.submit !== false;
    const status = submit ? 'SUBMITTED' : 'DRAFT';

    const row = await this.prisma.regulationRequest.create({
      data: {
        patientId: dto.patientId,
        facilityId: dto.facilityId,
        professionalId: dto.professionalId,
        encounterId: dto.encounterId,
        procedureCode: code,
        procedureName,
        offProtocol,
        cid: dto.cid?.trim() || null,
        clinicalSummary: dto.clinicalSummary?.trim() || null,
        priority,
        status,
      },
      include: this.include(),
    });

    const rfIds: string[] = [RF.REGULATION_REQUEST.id, RF.REGULATION_PRE.id];
    if (offProtocol) rfIds.push(RF.REGULATION_PROTOCOL_ALERT.id);

    await this.prisma.audit('create', 'regulation_request', row.id, rfIds, {
      procedureCode: code,
      offProtocol,
      status,
    });

    return row;
  }

  async submit(id: string) {
    const row = await this.get(id);
    if (row.status !== 'DRAFT' && row.status !== 'RETURNED') {
      throw new BadRequestException('Só rascunho ou devolvida pode ser enviada à fila');
    }
    const updated = await this.prisma.regulationRequest.update({
      where: { id },
      data: { status: 'SUBMITTED', returnReason: null },
      include: this.include(),
    });
    await this.prisma.audit('submit', 'regulation_request', id, [
      RF.REGULATION_REQUEST.id,
      RF.REGULATION_QUEUE.id,
    ]);
    return updated;
  }

  async classify(id: string, dto: ClassifyRegulationDto) {
    const row = await this.get(id);
    if (!['SUBMITTED', 'CLASSIFIED', 'RETURNED'].includes(row.status)) {
      throw new BadRequestException('Status não permite classificação');
    }
    const updated = await this.prisma.regulationRequest.update({
      where: { id },
      data: {
        status: 'CLASSIFIED',
        classification: dto.classification,
        priority: dto.priority || row.priority,
        regulatorNotes: dto.notes ?? row.regulatorNotes,
      },
      include: this.include(),
    });
    await this.prisma.audit('classify', 'regulation_request', id, [
      RF.REGULATION_QUEUE.id,
      RF.REGULATION_DECIDE.id,
    ], { classification: dto.classification });
    return updated;
  }

  async authorize(id: string, dto: AuthorizeRegulationDto = {}) {
    const row = await this.get(id);
    if (!['SUBMITTED', 'CLASSIFIED'].includes(row.status)) {
      throw new BadRequestException('Status não permite autorização');
    }
    const scheduledHint = dto.scheduledHint ? new Date(dto.scheduledHint) : null;
    const status = scheduledHint ? 'SCHEDULED' : 'AUTHORIZED';
    const updated = await this.prisma.regulationRequest.update({
      where: { id },
      data: {
        status,
        scheduledHint,
        regulatorNotes: dto.notes ?? row.regulatorNotes,
        decidedAt: new Date(),
      },
      include: this.include(),
    });
    await this.prisma.audit('authorize', 'regulation_request', id, [RF.REGULATION_DECIDE.id], {
      status,
    });
    return updated;
  }

  async deny(id: string, dto: DenyRegulationDto) {
    const row = await this.get(id);
    if (!['SUBMITTED', 'CLASSIFIED'].includes(row.status)) {
      throw new BadRequestException('Status não permite negação');
    }
    if (!dto.reason?.trim()) throw new BadRequestException('reason obrigatório');
    const updated = await this.prisma.regulationRequest.update({
      where: { id },
      data: {
        status: 'DENIED',
        denialReason: dto.reason.trim(),
        regulatorNotes: dto.notes ?? row.regulatorNotes,
        decidedAt: new Date(),
      },
      include: this.include(),
    });
    await this.prisma.audit('deny', 'regulation_request', id, [RF.REGULATION_DECIDE.id]);
    return updated;
  }

  async returnForData(id: string, dto: ReturnRegulationDto) {
    const row = await this.get(id);
    if (!['SUBMITTED', 'CLASSIFIED'].includes(row.status)) {
      throw new BadRequestException('Status não permite devolução');
    }
    if (!dto.reason?.trim()) throw new BadRequestException('reason obrigatório');
    const updated = await this.prisma.regulationRequest.update({
      where: { id },
      data: {
        status: 'RETURNED',
        returnReason: dto.reason.trim(),
      },
      include: this.include(),
    });
    await this.prisma.audit('return', 'regulation_request', id, [RF.REGULATION_DECIDE.id]);
    return updated;
  }

  async close(id: string, dto: CloseRegulationDto = {}) {
    const row = await this.get(id);
    if (['CLOSED', 'DENIED'].includes(row.status)) {
      throw new BadRequestException('Solicitação já encerrada ou negada');
    }
    const updated = await this.prisma.regulationRequest.update({
      where: { id },
      data: {
        status: 'CLOSED',
        regulatorNotes: dto.notes ?? row.regulatorNotes,
        decidedAt: row.decidedAt || new Date(),
      },
      include: this.include(),
    });
    await this.prisma.audit('close', 'regulation_request', id, [RF.REGULATION_DECIDE.id]);
    return updated;
  }
}
