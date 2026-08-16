import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { evaluatePatientMatch, type MatchPerson } from './patient-match';
import { runRulesEngine, type RulesEngineInput } from './rules-engine';
import { lediXmlToComposition } from './adapters/ledi-xml.adapter';
import {
  nativeFichaToEncounter,
  nativeKeyFor,
  type NativeFichaInput,
} from './adapters/native-ficha.adapter';
import type { SigsEncounter, SigsPatient } from './sigs-fhir.types';

@Injectable()
export class ClinicalCoreService {
  constructor(private readonly prisma: PrismaService) {}

  normalizeLediXml(xml: string) {
    return lediXmlToComposition(xml);
  }

  runRules(input: RulesEngineInput) {
    return runRulesEngine(input);
  }

  async upsertIdentifiers(
    patientId: string,
    identifiers: Array<{ system: string; value: string; use?: string; source?: string }>,
  ) {
    const out = [];
    for (const id of identifiers) {
      const value = id.system === 'cpf' || id.system === 'cns' ? id.value.replace(/\D/g, '') : id.value.trim();
      if (!value) continue;
      const row = await this.prisma.patientIdentifier.upsert({
        where: { system_value: { system: id.system, value } },
        create: {
          patientId,
          system: id.system,
          value,
          use: id.use || 'official',
          source: id.source || 'cadastro',
        },
        update: {
          patientId,
          use: id.use || 'official',
          source: id.source || 'cadastro',
        },
      });
      out.push(row);
    }
    return out;
  }

  /**
   * Move vínculos do perdedor para o vencedor e desativa o perdedor.
   */
  async mergePatients(winnerId: string, loserId: string, actorId?: string) {
    if (winnerId === loserId) throw new BadRequestException('winner e loser iguais');
    const [winner, loser] = await Promise.all([
      this.prisma.patient.findUnique({ where: { id: winnerId } }),
      this.prisma.patient.findUnique({ where: { id: loserId } }),
    ]);
    if (!winner || !loser) throw new NotFoundException('Paciente não encontrado');
    if (!winner.active) throw new BadRequestException('Vencedor já está inativo/unificado');
    if (!loser.active) throw new BadRequestException('Perdedor já unificado');

    await this.prisma.$transaction(async (tx) => {
      await tx.patientTeamLink.updateMany({ where: { patientId: loserId }, data: { patientId: winnerId } });
      await tx.appointmentSlot.updateMany({ where: { patientId: loserId }, data: { patientId: winnerId } });
      await tx.encounter.updateMany({ where: { patientId: loserId }, data: { patientId: winnerId } });
      await tx.vaccinationRecord.updateMany({ where: { patientId: loserId }, data: { patientId: winnerId } });
      await tx.dentalEncounter.updateMany({ where: { patientId: loserId }, data: { patientId: winnerId } });
      await tx.homeCareVisit.updateMany({ where: { patientId: loserId }, data: { patientId: winnerId } });
      const adWithLoserChild = await tx.homeCareVisit.findMany({
        where: { childrenJson: { contains: loserId } },
        select: { id: true, childrenJson: true },
      });
      for (const visit of adWithLoserChild) {
        try {
          const children = JSON.parse(visit.childrenJson || '[]') as Array<{ patientId?: string }>;
          if (!Array.isArray(children) || !children.some((c) => c.patientId === loserId)) continue;
          const next = children.map((c) =>
            c.patientId === loserId ? { ...c, patientId: winnerId } : c,
          );
          await tx.homeCareVisit.update({
            where: { id: visit.id },
            data: { childrenJson: JSON.stringify(next) },
          });
        } catch {
          /* childrenJson inválido — ignore */
        }
      }
      await tx.queueTicket.updateMany({ where: { patientId: loserId }, data: { patientId: winnerId } });
      await tx.prescription.updateMany({ where: { patientId: loserId }, data: { patientId: winnerId } });
      await tx.regulationRequest.updateMany({ where: { patientId: loserId }, data: { patientId: winnerId } });
      await tx.productionRecord.updateMany({ where: { patientId: loserId }, data: { patientId: winnerId } });

      const loserIds = await tx.patientIdentifier.findMany({ where: { patientId: loserId } });
      for (const id of loserIds) {
        const onWinner = await tx.patientIdentifier.findFirst({
          where: { patientId: winnerId, system: id.system, value: id.value },
        });
        if (onWinner) {
          await tx.patientIdentifier.delete({ where: { id: id.id } });
        } else {
          await tx.patientIdentifier.update({
            where: { id: id.id },
            data: {
              patientId: winnerId,
              source: 'merge',
              use: id.use === 'official' ? 'secondary' : id.use,
            },
          });
        }
      }

      await tx.patient.update({
        where: { id: winnerId },
        data: {
          cpf: winner.cpf || loser.cpf,
          cns: winner.cns || loser.cns,
          socialName: winner.socialName || loser.socialName,
          motherName: winner.motherName || loser.motherName,
          phone: winner.phone || loser.phone,
        },
      });

      await tx.patient.update({
        where: { id: loserId },
        data: { active: false, mergedIntoId: winnerId },
      });

      await tx.clinicalAuditEvent.create({
        data: {
          action: 'merge',
          entityType: 'Patient',
          entityId: winnerId,
          actorId: actorId || 'system',
          payloadJson: JSON.stringify({ winnerId, loserId, kind: 'fk_move' }),
        },
      });
    });

    return { winnerId, loserId, merged: true };
  }

  async proposeMatch(left: MatchPerson & { id: string }, right: MatchPerson & { id: string }, actorId?: string) {
    if (left.id === right.id) {
      return { skipped: true as const, reason: 'same_id' };
    }
    const result = evaluatePatientMatch(left, right);
    const status =
      result.action === 'auto_merge'
        ? 'auto_merged'
        : result.action === 'pending_review'
          ? 'pending_review'
          : 'signal_only';

    const candidate = await this.prisma.patientMatchCandidate.create({
      data: {
        leftPatientId: left.id,
        rightPatientId: right.id,
        confidence: result.confidence,
        score: result.score,
        status,
        evidenceJson: JSON.stringify(result.evidence),
        winnerPatientId: status === 'auto_merged' ? left.id : null,
        reviewedAt: status === 'auto_merged' ? new Date() : null,
        reviewedBy: status === 'auto_merged' ? actorId || 'system' : null,
      },
    });

    let merge: { winnerId: string; loserId: string; merged: boolean } | undefined;
    if (status === 'auto_merged') {
      merge = await this.mergePatients(left.id, right.id, actorId);
    }

    await this.prisma.clinicalAuditEvent.create({
      data: {
        action: 'merge',
        entityType: 'PatientMatchCandidate',
        entityId: candidate.id,
        actorId: actorId || 'system',
        payloadJson: JSON.stringify({
          confidence: result.confidence,
          score: result.score,
          action: result.action,
          left: left.id,
          right: right.id,
          evidence: result.evidence,
          merge,
        }),
      },
    });

    return { skipped: false as const, result, candidate, merge };
  }

  async listMatchQueue(status = 'pending_review') {
    return this.prisma.patientMatchCandidate.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        leftPatient: { select: { id: true, civilName: true, cpf: true, cns: true, birthDate: true, active: true } },
        rightPatient: { select: { id: true, civilName: true, cpf: true, cns: true, birthDate: true, active: true } },
      },
    });
  }

  async resolveMatch(candidateId: string, decision: 'accept' | 'reject', winnerId?: string, actorId?: string) {
    const candidate = await this.prisma.patientMatchCandidate.findUnique({ where: { id: candidateId } });
    if (!candidate) throw new NotFoundException('Candidato não encontrado');
    if (candidate.status !== 'pending_review') {
      throw new BadRequestException(`Status atual: ${candidate.status}`);
    }

    if (decision === 'reject') {
      const updated = await this.prisma.patientMatchCandidate.update({
        where: { id: candidateId },
        data: {
          status: 'rejected',
          reviewedAt: new Date(),
          reviewedBy: actorId || 'system',
        },
      });
      return { candidate: updated, merge: null };
    }

    const win = winnerId || candidate.leftPatientId;
    const lose = win === candidate.leftPatientId ? candidate.rightPatientId : candidate.leftPatientId;
    const merge = await this.mergePatients(win, lose, actorId);
    const updated = await this.prisma.patientMatchCandidate.update({
      where: { id: candidateId },
      data: {
        status: 'merged_manual',
        winnerPatientId: win,
        reviewedAt: new Date(),
        reviewedBy: actorId || 'system',
      },
    });
    return { candidate: updated, merge };
  }

  private async resolveOrCreatePatientFromSigs(p: SigsPatient | undefined, source: string) {
    if (!p) {
      throw new BadRequestException('Encounter sem paciente');
    }
    const cpf = p.identifiers.find((i) => i.system === 'cpf')?.value;
    const cns = p.identifiers.find((i) => i.system === 'cns')?.value;

    if (cpf) {
      const byId = await this.prisma.patientIdentifier.findUnique({
        where: { system_value: { system: 'cpf', value: cpf } },
        include: { patient: true },
      });
      if (byId?.patient) {
        const master = byId.patient.mergedIntoId
          ? await this.prisma.patient.findUniqueOrThrow({ where: { id: byId.patient.mergedIntoId } })
          : byId.patient;
        return master;
      }
      const byCol = await this.prisma.patient.findFirst({ where: { cpf, active: true } });
      if (byCol) {
        await this.upsertIdentifiers(byCol.id, p.identifiers.map((i) => ({ ...i, source })));
        return byCol;
      }
    }
    if (cns) {
      const byId = await this.prisma.patientIdentifier.findUnique({
        where: { system_value: { system: 'cns', value: cns } },
        include: { patient: true },
      });
      if (byId?.patient) {
        const master = byId.patient.mergedIntoId
          ? await this.prisma.patient.findUniqueOrThrow({ where: { id: byId.patient.mergedIntoId } })
          : byId.patient;
        return master;
      }
      const byCol = await this.prisma.patient.findFirst({ where: { cns, active: true } });
      if (byCol) {
        await this.upsertIdentifiers(byCol.id, p.identifiers.map((i) => ({ ...i, source })));
        return byCol;
      }
    }

    const birth = p.birthDate ? new Date(p.birthDate) : new Date('1900-01-01');
    const created = await this.prisma.patient.create({
      data: {
        civilName: p.civilName || 'Paciente migrado (sem nome)',
        cpf: cpf || null,
        cns: cns || null,
        birthDate: birth,
        sex: p.sex === 'male' ? 'M' : p.sex === 'female' ? 'F' : 'I',
        motherNameUnknown: true,
        notes: `Criado via migração (${source})`,
      },
    });
    await this.upsertIdentifiers(
      created.id,
      p.identifiers.map((i) => ({ ...i, source })),
    );
    return created;
  }

  private async persistEncounter(enc: SigsEncounter, opts: { sourceXml?: string; source: string; fichaTipo: string }) {
    const patient = await this.resolveOrCreatePatientFromSigs(enc.patient, opts.source);
    const uuid = enc.uuidFicha || null;
    if (uuid) {
      const existing = await this.prisma.productionRecord.findUnique({ where: { uuidFicha: uuid } });
      if (existing) {
        return { patient, record: existing, created: false };
      }
    }
    const record = await this.prisma.productionRecord.create({
      data: {
        patientId: patient.id,
        fichaTipo: opts.fichaTipo,
        uuidFicha: uuid,
        facilityCnes: enc.cnes || null,
        professionalCns: enc.practitionerCns || null,
        cbo: enc.cbo || null,
        ine: enc.ine || null,
        periodStart: enc.periodStart ? new Date(enc.periodStart) : null,
        periodEnd: enc.periodEnd ? new Date(enc.periodEnd) : null,
        encounterJson: JSON.stringify(enc),
        sourceXml: opts.sourceXml || null,
        source: opts.source,
      },
    });
    return { patient, record, created: true };
  }

  /**
   * LEDI P1: persiste Encounter + Condition/Procedure mínimos a partir da ficha nativa.
   * Upsert por uuidFicha LEDI ou chave `native:FAI|FAO:{id}`. Não grava XML.
   */
  async persistNativeEncounter(input: NativeFichaInput & { actorId?: string }) {
    const encounter = nativeFichaToEncounter(input);
    const nativeKey = nativeKeyFor(input.fichaTipo, input.encounterId);
    const uuidFicha = input.uuidFicha || nativeKey;

    const patientRow = await this.prisma.patient.findUnique({ where: { id: input.patient.id } });
    if (!patientRow) throw new NotFoundException('Paciente não encontrado');
    const master = patientRow.mergedIntoId
      ? await this.prisma.patient.findUniqueOrThrow({ where: { id: patientRow.mergedIntoId } })
      : patientRow;

    await this.upsertIdentifiers(
      master.id,
      (encounter.patient?.identifiers || []).map((i) => ({ ...i, source: 'native' })),
    );

    const keys = [...new Set([uuidFicha, nativeKey])];
    let existing: { id: string } | null = null;
    for (const k of keys) {
      existing = await this.prisma.productionRecord.findUnique({ where: { uuidFicha: k } });
      if (existing) break;
    }

    const data = {
      patientId: master.id,
      fichaTipo: input.fichaTipo,
      uuidFicha,
      facilityCnes: encounter.cnes || null,
      professionalCns: encounter.practitionerCns || null,
      cbo: encounter.cbo || null,
      ine: encounter.ine || null,
      periodStart: encounter.periodStart ? new Date(encounter.periodStart) : null,
      periodEnd: encounter.periodEnd ? new Date(encounter.periodEnd) : null,
      encounterJson: JSON.stringify(encounter),
      sourceXml: null as string | null,
      source: 'native',
    };

    const record = existing
      ? await this.prisma.productionRecord.update({ where: { id: existing.id }, data })
      : await this.prisma.productionRecord.create({ data });

    await this.prisma.clinicalAuditEvent.create({
      data: {
        action: 'persist',
        entityType: 'ProductionRecord',
        entityId: record.id,
        actorId: input.actorId || 'system',
        payloadJson: JSON.stringify({
          source: 'native',
          fichaTipo: input.fichaTipo,
          encounterId: input.encounterId,
          uuidFicha,
          nativeKey,
          created: !existing,
          conditionCount: encounter.conditions.length,
          procedureCount: encounter.procedures.length,
        }),
      },
    });

    return { patient: master, record, created: !existing, encounter };
  }

  /** Dry-run de migração (só audita). */
  async migrateXmlDryRun(xml: string, fileName?: string) {
    const composition = lediXmlToComposition(xml);
    const engine = runRulesEngine({ xml, composition, rulePack: composition.fichaTipo as 'FAO' | 'FAI' | 'PROCEDIMENTOS' | undefined });
    await this.prisma.clinicalAuditEvent.create({
      data: {
        action: 'migrate',
        entityType: 'LediXml',
        entityId: composition.uuidFicha || fileName || null,
        payloadJson: JSON.stringify({
          fileName,
          fichaTipo: composition.fichaTipo,
          encounters: composition.encounters.length,
          findings: engine.findings.length,
          blockers: engine.findings.filter((f) => f.severity === 'BLOCKER').length,
          dryRun: true,
        }),
      },
    });
    return engine;
  }

  /**
   * Migração real: validate → resolve/cria paciente → persiste ProductionRecord.
   * Bloqueios BLOCKER impedem persistir (salvo force).
   */
  async migrateXmlPersist(xml: string, opts?: { fileName?: string; force?: boolean; actorId?: string }) {
    const composition = lediXmlToComposition(xml);
    const pack =
      composition.fichaTipo === 'FAO' || composition.fichaTipo === 'FAI' || composition.fichaTipo === 'PROCEDIMENTOS'
        ? composition.fichaTipo
        : undefined;
    const engine = runRulesEngine({ xml, composition, rulePack: pack });
    const blockers = engine.findings.filter((f) => f.severity === 'BLOCKER');
    if (blockers.length && !opts?.force) {
      await this.prisma.clinicalAuditEvent.create({
        data: {
          action: 'migrate',
          entityType: 'LediXml',
          entityId: composition.uuidFicha || opts?.fileName || null,
          actorId: opts?.actorId || 'system',
          payloadJson: JSON.stringify({
            fileName: opts?.fileName,
            rejected: true,
            blockers: blockers.map((b) => b.code),
          }),
        },
      });
      return {
        persisted: false as const,
        reason: 'blockers',
        blockers: blockers.map((b) => b.code),
        engine,
        records: [],
      };
    }

    const records = [];
    for (let i = 0; i < composition.encounters.length; i++) {
      const enc = composition.encounters[i]!;
      const baseUuid = enc.uuidFicha || composition.uuidFicha;
      const uuid =
        baseUuid && composition.encounters.length > 1 ? `${baseUuid}#${i + 1}` : baseUuid || undefined;
      const encWithUuid = { ...enc, uuidFicha: uuid };
      const saved = await this.persistEncounter(encWithUuid, {
        sourceXml: xml,
        source: 'migration',
        fichaTipo: composition.fichaTipo,
      });
      records.push(saved);
    }

    await this.prisma.clinicalAuditEvent.create({
      data: {
        action: 'migrate',
        entityType: 'ProductionRecord',
        entityId: composition.uuidFicha || opts?.fileName || null,
        actorId: opts?.actorId || 'system',
        payloadJson: JSON.stringify({
          fileName: opts?.fileName,
          fichaTipo: composition.fichaTipo,
          persisted: records.length,
          created: records.filter((r) => r.created).length,
          force: !!opts?.force,
        }),
      },
    });

    return {
      persisted: true as const,
      engine,
      records: records.map((r) => ({
        patientId: r.patient.id,
        productionRecordId: r.record.id,
        created: r.created,
      })),
    };
  }
}
