import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RF } from '../common/rf';
import { CreatePatientDto, UpdatePatientDto } from './dto';

const NATIONALITIES = new Set(['BRASILEIRA', 'NATURALIZADA', 'ESTRANGEIRA']);

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
  nationality?: string | null;
  birthMunicipalityIbge?: string | null;
  raceColor?: string | null;
  ethnicity?: string | null;
  hasDisability?: boolean;
  disabilityCodes?: string[];
  email?: string | null;
  nis?: string | null;
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

    // RF-2.30 — campos CDS essenciais
    if (dto.nationality) {
      const nat = dto.nationality.toUpperCase();
      if (!NATIONALITIES.has(nat)) {
        errors.push('nationality deve ser BRASILEIRA, NATURALIZADA ou ESTRANGEIRA');
      } else if (nat === 'BRASILEIRA') {
        const ibge = dto.birthMunicipalityIbge?.trim();
        if (!ibge || !/^\d{6,7}$/.test(ibge)) {
          errors.push('birthMunicipalityIbge (6–7 dígitos) obrigatório para nacionalidade BRASILEIRA');
        }
      }
    }
    const race = (dto.raceColor || '').toUpperCase();
    if ((race.includes('INDIGEN') || race === '5' || race === 'INDIGENA') && !dto.ethnicity?.trim()) {
      errors.push('ethnicity obrigatória quando raça/cor é indígena');
    }
    if (dto.hasDisability && !(dto.disabilityCodes?.length)) {
      errors.push('disabilityCodes obrigatório quando hasDisability=true');
    }
    if (dto.nis && !/^\d{11}$/.test(dto.nis)) errors.push('nis deve ter 11 dígitos');
    if (dto.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.email)) errors.push('email inválido');

    if (errors.length) throw new BadRequestException({ errors });
  }

  private map(row: {
    civilName: string;
    socialName: string | null;
    disabilityCodesJson?: string;
    [k: string]: unknown;
  }) {
    let disabilityCodes: string[] = [];
    try {
      disabilityCodes = JSON.parse(row.disabilityCodesJson || '[]') as string[];
    } catch {
      disabilityCodes = [];
    }
    return {
      ...row,
      displayName: row.socialName || row.civilName,
      disabilityCodes,
    };
  }

  async search(q?: string, birthDate?: string) {
    const rows = await this.prisma.patient.findMany({
      where: {
        active: true,
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

  private async syncIdentifiers(patientId: string, cpf?: string | null, cns?: string | null) {
    if (cpf) {
      await this.prisma.patientIdentifier.upsert({
        where: { system_value: { system: 'cpf', value: cpf } },
        create: { patientId, system: 'cpf', value: cpf, use: 'official', source: 'cadastro' },
        update: { patientId, use: 'official', source: 'cadastro' },
      });
    }
    if (cns) {
      await this.prisma.patientIdentifier.upsert({
        where: { system_value: { system: 'cns', value: cns } },
        create: { patientId, system: 'cns', value: cns, use: 'official', source: 'cadastro' },
        update: { patientId, use: 'official', source: 'cadastro' },
      });
    }
  }

  private cdsData(dto: CreatePatientDto | UpdatePatientDto, current?: {
    nationality: string | null;
    birthMunicipalityIbge: string | null;
    ethnicity: string | null;
    hasDisability: boolean;
    disabilityCodesJson: string;
    email: string | null;
    nis: string | null;
    educationLevel: string | null;
  }) {
    const disabilityCodes =
      'disabilityCodes' in dto && dto.disabilityCodes !== undefined
        ? dto.disabilityCodes
        : current
          ? (JSON.parse(current.disabilityCodesJson || '[]') as string[])
          : [];
    return {
      nationality:
        dto.nationality !== undefined
          ? dto.nationality?.toUpperCase() || null
          : current?.nationality ?? null,
      birthMunicipalityIbge:
        dto.birthMunicipalityIbge !== undefined
          ? dto.birthMunicipalityIbge || null
          : current?.birthMunicipalityIbge ?? null,
      ethnicity:
        dto.ethnicity !== undefined ? dto.ethnicity || null : current?.ethnicity ?? null,
      hasDisability:
        dto.hasDisability !== undefined ? dto.hasDisability : current?.hasDisability ?? false,
      disabilityCodesJson: JSON.stringify(disabilityCodes),
      email: dto.email !== undefined ? dto.email || null : current?.email ?? null,
      nis: dto.nis !== undefined ? dto.nis || null : current?.nis ?? null,
      educationLevel:
        dto.educationLevel !== undefined
          ? dto.educationLevel || null
          : current?.educationLevel ?? null,
    };
  }

  async create(dto: CreatePatientDto) {
    this.validate({
      ...dto,
      disabilityCodes: dto.disabilityCodes,
    });
    const cds = this.cdsData(dto);
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
        ...cds,
      },
    });
    await this.syncIdentifiers(row.id, row.cpf, row.cns);
    await this.prisma.audit('create', 'patient', row.id, [
      RF.PATIENT.id,
      RF.PATIENT_LIST.id,
      RF.PATIENT_CDS.id,
    ]);
    return this.map(row);
  }

  async get(id: string) {
    const row = await this.prisma.patient.findUnique({
      where: { id },
      include: {
        links: {
          where: { active: true },
          include: {
            team: { include: { facility: true } },
            microArea: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!row) throw new NotFoundException('Paciente não encontrado');
    return this.map(row);
  }

  async update(id: string, dto: UpdatePatientDto) {
    const current = await this.prisma.patient.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Paciente não encontrado');

    const cds = this.cdsData(dto, current);
    let disabilityCodes: string[] = [];
    try {
      disabilityCodes = JSON.parse(cds.disabilityCodesJson || '[]') as string[];
    } catch {
      disabilityCodes = [];
    }

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
      nationality: cds.nationality,
      birthMunicipalityIbge: cds.birthMunicipalityIbge,
      raceColor: dto.raceColor !== undefined ? dto.raceColor : current.raceColor,
      ethnicity: cds.ethnicity,
      hasDisability: cds.hasDisability,
      disabilityCodes,
      email: cds.email,
      nis: cds.nis,
    };

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
          dto.addressNeighborhood !== undefined
            ? dto.addressNeighborhood
            : current.addressNeighborhood,
        addressCity: dto.addressCity !== undefined ? dto.addressCity : current.addressCity,
        addressState:
          dto.addressState !== undefined ? dto.addressState.toUpperCase() : current.addressState,
        addressZip: dto.addressZip !== undefined ? dto.addressZip : current.addressZip,
        ...cds,
      },
    });
    await this.syncIdentifiers(row.id, row.cpf, row.cns);
    await this.prisma.audit('update', 'patient', row.id, [RF.PATIENT.id, RF.PATIENT_CDS.id]);
    return this.map(row);
  }
}
