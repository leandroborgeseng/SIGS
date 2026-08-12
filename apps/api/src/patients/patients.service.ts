import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RF } from '../common/rf';
import { CreatePatientDto, UpdatePatientDto } from './dto';

type PatientValidation = {
  civilName?: string;
  socialName?: string;
  cpf?: string;
  cns?: string;
  birthDate: string;
  sex?: string;
  motherName?: string;
  motherNameUnknown?: boolean;
  fatherName?: string;
  fatherNameUnknown?: boolean;
  isDeceased?: boolean;
  deathDate?: string;
  deathCertificate?: string;
};

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  private validate(dto: PatientValidation) {
    const errors: string[] = [];
    const birth = new Date(dto.birthDate);
    if (birth > new Date()) errors.push('birthDate não pode ser futura');

    const motherUnknown = dto.motherNameUnknown ?? false;
    if (motherUnknown) {
      if (dto.motherName) errors.push('motherName deve estar vazio quando motherNameUnknown=true');
    } else if (!dto.motherName?.trim()) {
      errors.push('motherName é obrigatório (ou marque motherNameUnknown)');
    }

    if ((dto.fatherNameUnknown ?? false) && dto.fatherName) {
      errors.push('fatherName deve estar vazio quando fatherNameUnknown=true');
    }

    const deceased = dto.isDeceased ?? false;
    if (deceased) {
      if (!dto.deathDate) errors.push('deathDate obrigatório quando isDeceased=true');
      else if (new Date(dto.deathDate) < birth) errors.push('deathDate anterior a birthDate');
      if (!dto.deathCertificate?.trim()) errors.push('deathCertificate obrigatório quando isDeceased=true');
    } else if (dto.deathDate || dto.deathCertificate) {
      errors.push('campos de óbito só quando isDeceased=true');
    }

    if (dto.cpf && dto.cpf.length !== 11) errors.push('cpf deve ter 11 dígitos');
    if (dto.cns && (dto.cns.length < 15 || dto.cns.length > 16)) errors.push('cns 15–16 dígitos');

    if (errors.length) throw new BadRequestException({ errors });
  }

  private map(row: {
    civilName: string;
    socialName: string | null;
    [k: string]: unknown;
  }) {
    return { ...row, displayName: row.socialName || row.civilName };
  }

  async search(q?: string, birthDate?: string) {
    const rows = await this.prisma.patient.findMany({
      where: {
        ...(birthDate ? { birthDate: new Date(birthDate) } : {}),
        ...(q
          ? {
              OR: [
                { civilName: { contains: q } },
                { socialName: { contains: q } },
                { cpf: { contains: q } },
                { cns: { contains: q } },
                { motherName: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { civilName: 'asc' },
    });
    return rows.map((r) => this.map(r));
  }

  async create(dto: CreatePatientDto) {
    this.validate(dto);
    const row = await this.prisma.patient.create({
      data: {
        civilName: dto.civilName,
        socialName: dto.socialName,
        cpf: dto.cpf,
        cns: dto.cns,
        birthDate: new Date(dto.birthDate),
        sex: dto.sex,
        raceColor: dto.raceColor,
        motherName: dto.motherName,
        motherNameUnknown: dto.motherNameUnknown ?? false,
        fatherName: dto.fatherName,
        fatherNameUnknown: dto.fatherNameUnknown ?? false,
        isDeceased: dto.isDeceased ?? false,
        deathDate: dto.deathDate ? new Date(dto.deathDate) : null,
        deathCertificate: dto.deathCertificate,
        phone: dto.phone,
        notes: dto.notes,
        addressStreet: dto.addressStreet,
        addressNumber: dto.addressNumber,
        addressComplement: dto.addressComplement,
        addressNeighborhood: dto.addressNeighborhood,
        addressCity: dto.addressCity,
        addressState: dto.addressState?.toUpperCase(),
        addressZip: dto.addressZip,
      },
    });
    await this.prisma.audit('create', 'patient', row.id, [RF.PATIENT.id, RF.PATIENT_LIST.id]);
    return this.map(row);
  }

  async get(id: string) {
    const row = await this.prisma.patient.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Paciente não encontrado');
    return this.map(row);
  }

  async update(id: string, dto: UpdatePatientDto) {
    const current = await this.prisma.patient.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Paciente não encontrado');

    const merged: PatientValidation = {
      civilName: dto.civilName ?? current.civilName,
      socialName: dto.socialName !== undefined ? dto.socialName : current.socialName || undefined,
      cpf: dto.cpf !== undefined ? dto.cpf : current.cpf || undefined,
      cns: dto.cns !== undefined ? dto.cns : current.cns || undefined,
      birthDate: dto.birthDate ?? current.birthDate.toISOString().slice(0, 10),
      sex: dto.sex ?? current.sex,
      motherName: dto.motherName !== undefined ? dto.motherName : current.motherName || undefined,
      motherNameUnknown: dto.motherNameUnknown ?? current.motherNameUnknown,
      fatherName: dto.fatherName !== undefined ? dto.fatherName : current.fatherName || undefined,
      fatherNameUnknown: dto.fatherNameUnknown ?? current.fatherNameUnknown,
      isDeceased: dto.isDeceased ?? current.isDeceased,
      deathDate:
        dto.deathDate !== undefined
          ? dto.deathDate
          : current.deathDate
            ? current.deathDate.toISOString().slice(0, 10)
            : undefined,
      deathCertificate:
        dto.deathCertificate !== undefined
          ? dto.deathCertificate
          : current.deathCertificate || undefined,
    };

    // limpar óbito se desmarcado
    if (merged.isDeceased === false) {
      merged.deathDate = undefined;
      merged.deathCertificate = undefined;
    }
    if (merged.motherNameUnknown) merged.motherName = undefined;
    if (merged.fatherNameUnknown) merged.fatherName = undefined;

    this.validate(merged);

    const row = await this.prisma.patient.update({
      where: { id },
      data: {
        civilName: merged.civilName,
        socialName: merged.socialName,
        cpf: merged.cpf,
        cns: merged.cns,
        birthDate: new Date(merged.birthDate),
        sex: merged.sex,
        raceColor: dto.raceColor !== undefined ? dto.raceColor : current.raceColor,
        motherName: merged.motherName ?? null,
        motherNameUnknown: merged.motherNameUnknown ?? false,
        fatherName: merged.fatherName ?? null,
        fatherNameUnknown: merged.fatherNameUnknown ?? false,
        isDeceased: merged.isDeceased ?? false,
        deathDate: merged.deathDate ? new Date(merged.deathDate) : null,
        deathCertificate: merged.deathCertificate ?? null,
        phone: dto.phone !== undefined ? dto.phone : current.phone,
        notes: dto.notes !== undefined ? dto.notes : current.notes,
        addressStreet: dto.addressStreet !== undefined ? dto.addressStreet : current.addressStreet,
        addressNumber: dto.addressNumber !== undefined ? dto.addressNumber : current.addressNumber,
        addressComplement:
          dto.addressComplement !== undefined ? dto.addressComplement : current.addressComplement,
        addressNeighborhood:
          dto.addressNeighborhood !== undefined ? dto.addressNeighborhood : current.addressNeighborhood,
        addressCity: dto.addressCity !== undefined ? dto.addressCity : current.addressCity,
        addressState:
          dto.addressState !== undefined ? dto.addressState.toUpperCase() : current.addressState,
        addressZip: dto.addressZip !== undefined ? dto.addressZip : current.addressZip,
      },
    });
    await this.prisma.audit('update', 'patient', row.id, [RF.PATIENT.id]);
    return this.map(row);
  }
}
