import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Dados fictícios para piloto local — nunca dados reais de pacientes. */
@Injectable()
export class DemoSeedService implements OnModuleInit {
  private readonly log = new Logger(DemoSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    if (process.env.SKIP_DEMO_SEED === '1') return;
    await this.ensureDemoSeeded();
  }

  async ensureDemoSeeded() {
    const existing = await this.prisma.facility.findFirst({
      where: { cnes: '9999999' },
    });
    if (existing) {
      await this.ensureDemoAssignments(existing.id);
      if (!existing.ibgeCode) {
        await this.prisma.facility.update({
          where: { id: existing.id },
          data: { ibgeCode: '3516200' },
        });
        this.log.log('Demo seed: IBGE Franca (3516200) aplicado na UBS demo');
      }
      return { seeded: false, facilityId: existing.id, reason: 'already_present' };
    }

    const facility = await this.prisma.facility.create({
      data: {
        cnes: '9999999',
        name: 'UBS Centro Demonstração',
        active: true,
        typeId: 'UBS',
        ibgeCode: '3516200', // Franca/SP
      },
    });

    const team = await this.prisma.team.create({
      data: {
        facilityId: facility.id,
        name: 'eSF Demonstração 01',
        teamTypeId: 'ESF',
        ine: '0000000001',
        active: true,
      },
    });

    const micro = await this.prisma.microArea.create({
      data: {
        teamId: team.id,
        code: '01',
        name: 'Microárea 01 — Centro',
        active: true,
      },
    });

    const [dr, enf] = await Promise.all([
      this.prisma.professional.create({
        data: {
          civilName: 'Ana Paula Demonstração',
          cns: '898001111111111',
          cpf: '11111111111',
        },
      }),
      this.prisma.professional.create({
        data: {
          civilName: 'Carlos Enfermeiro Demo',
          cns: '898002222222222',
          cpf: '22222222222',
        },
      }),
    ]);

    const maria = await this.prisma.patient.create({
      data: {
        civilName: 'Maria Exemplo Silva',
        socialName: 'Maria Exemplo',
        cpf: '12345678901',
        cns: '898003333333333',
        birthDate: new Date('1988-05-12'),
        sex: 'F',
        motherName: 'Joana Exemplo Silva',
        fatherNameUnknown: true,
        phone: '16999990001',
      },
    });

    const joao = await this.prisma.patient.create({
      data: {
        civilName: 'João Exemplo Santos',
        cpf: '98765432100',
        cns: '898004444444444',
        birthDate: new Date('2019-03-01'),
        sex: 'M',
        motherName: 'Helena Exemplo Santos',
        fatherName: 'Pedro Exemplo Santos',
        phone: '16999990002',
      },
    });

    await this.prisma.patientTeamLink.createMany({
      data: [
        { patientId: maria.id, teamId: team.id, microAreaId: micro.id, active: true },
        { patientId: joao.id, teamId: team.id, microAreaId: micro.id, active: true },
      ],
    });

    const now = new Date();
    const day = new Date(now);
    day.setHours(9, 0, 0, 0);
    const slots = [
      { start: 0, patientId: maria.id, status: 'SCHEDULED' },
      { start: 30, patientId: joao.id, status: 'PRESENT' },
      { start: 60, patientId: null, status: 'SCHEDULED' },
    ];
    for (const s of slots) {
      const startsAt = new Date(day.getTime() + s.start * 60_000);
      const endsAt = new Date(startsAt.getTime() + 30 * 60_000);
      await this.prisma.appointmentSlot.create({
        data: {
          professionalId: dr.id,
          patientId: s.patientId,
          startsAt,
          endsAt,
          status: s.status,
          notes: 'Slot demo',
        },
      });
    }

    await this.prisma.encounter.create({
      data: {
        patientId: maria.id,
        facilityId: facility.id,
        professionalId: dr.id,
        teamId: team.id,
        status: 'WAITING',
        careLocation: 'UBS',
        shift: 'MANHA',
        encounterType: 'CONSULTA',
        clinicalJson: '{}',
      },
    });

    await this.prisma.vaccinationRecord.create({
      data: {
        patientId: joao.id,
        facilityId: facility.id,
        professionalId: enf.id,
        shift: 'MANHA',
        careLocation: 'UBS',
        status: 'READY',
        appliedAt: new Date(),
        applicationsJson: JSON.stringify([
          {
            immunobiologicalId: 'BCG',
            strategyId: 'ROUTINE',
            doseId: 'DU',
            attendanceGroupId: 'GERAL',
            lot: 'DEMO-BCG-01',
            manufacturer: 'Bio-Manguinhos',
            routeId: 'ID',
            siteId: 'LD',
            leprosyContact: false,
          },
        ]),
      },
    });

    await this.ensureDemoAssignments(facility.id, {
      professionalIds: { dr: dr.id, enf: enf.id },
      teamId: team.id,
    });

    this.log.log(`Demo seed criado: facility=${facility.id} (UBS Centro Demonstração)`);
    return {
      seeded: true,
      facilityId: facility.id,
      patients: [maria.id, joao.id],
      professionals: [dr.id, enf.id],
    };
  }

  /** Garante lotações demo (CNS+CBO+CNES+INE) mesmo em bases já seedadas. */
  private async ensureDemoAssignments(
    facilityId: string,
    ids?: { professionalIds: { dr: string; enf: string }; teamId: string },
  ) {
    let teamId = ids?.teamId;
    let drId = ids?.professionalIds.dr;
    let enfId = ids?.professionalIds.enf;

    if (!teamId || !drId || !enfId) {
      const team = await this.prisma.team.findFirst({
        where: { facilityId, ine: '0000000001' },
      });
      teamId = team?.id;
      const dr = await this.prisma.professional.findFirst({
        where: { cns: '898001111111111' },
      });
      const enf = await this.prisma.professional.findFirst({
        where: { cns: '898002222222222' },
      });
      drId = dr?.id;
      enfId = enf?.id;
    }
    if (!teamId || !drId || !enfId) return;

    const specs = [
      { professionalId: drId, cbo: '225125', roleLabel: 'Médico clínico' },
      { professionalId: enfId, cbo: '223505', roleLabel: 'Enfermeiro' },
    ];
    for (const s of specs) {
      const exists = await this.prisma.professionalAssignment.findFirst({
        where: {
          professionalId: s.professionalId,
          facilityId,
          cbo: s.cbo,
          active: true,
        },
      });
      if (exists) continue;
      await this.prisma.professionalAssignment.create({
        data: {
          professionalId: s.professionalId,
          facilityId,
          teamId,
          cbo: s.cbo,
          roleLabel: s.roleLabel,
          active: true,
        },
      });
      this.log.log(`Lotação demo: ${s.roleLabel} CBO ${s.cbo}`);
    }
  }
}
