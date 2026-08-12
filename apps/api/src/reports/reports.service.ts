import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private range(from?: string, to?: string) {
    return {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  async encounters(from?: string, to?: string, facilityId?: string) {
    const dateFilter = this.range(from, to);
    const rows = await this.prisma.encounter.findMany({
      where: {
        ...(facilityId ? { facilityId } : {}),
        ...(Object.keys(dateFilter).length ? { startedAt: dateFilter } : {}),
      },
      orderBy: { startedAt: 'desc' },
      include: {
        patient: true,
        facility: true,
        professional: true,
      },
    });

    return {
      filters: { from, to, facilityId },
      total: rows.length,
      byStatus: rows.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {}),
      items: rows.map((r) => ({
        id: r.id,
        status: r.status,
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        facilityName: r.facility.name,
        facilityCnes: r.facility.cnes,
        patientName: r.patient.socialName || r.patient.civilName,
        patientCpf: r.patient.cpf,
        professionalName: r.professional
          ? r.professional.socialName || r.professional.civilName
          : null,
      })),
    };
  }

  async vaccinations(from?: string, to?: string, facilityId?: string) {
    const dateFilter = this.range(from, to);
    const rows = await this.prisma.vaccinationRecord.findMany({
      where: {
        ...(facilityId ? { facilityId } : {}),
        ...(Object.keys(dateFilter).length ? { appliedAt: dateFilter } : {}),
      },
      orderBy: { appliedAt: 'desc' },
      include: { patient: true, facility: true },
    });

    const items = rows.flatMap((r) => {
      const apps = JSON.parse(r.applicationsJson || '[]') as Array<{
        immunobiologicalId: string;
        doseId: string;
        lot: string;
        strategyId: string;
      }>;
      return apps.map((a) => ({
        recordId: r.id,
        appliedAt: r.appliedAt,
        status: r.status,
        facilityName: r.facility.name,
        patientName: r.patient.socialName || r.patient.civilName,
        immunobiological: a.immunobiologicalId,
        dose: a.doseId,
        lot: a.lot,
        strategy: a.strategyId,
      }));
    });

    return {
      filters: { from, to, facilityId },
      totalRecords: rows.length,
      totalDoses: items.length,
      items,
    };
  }
}
