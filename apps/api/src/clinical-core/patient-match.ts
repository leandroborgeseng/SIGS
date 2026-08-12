/**
 * Unificação de pacientes por confiança (A0 — regras puras, sem DB).
 */

export type MatchConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type MatchPerson = {
  id?: string;
  cpf?: string | null;
  cns?: string | null;
  civilName?: string | null;
  birthDate?: string | null; // YYYY-MM-DD
  motherName?: string | null;
};

export type MatchResult = {
  confidence: MatchConfidence;
  score: number;
  evidence: string[];
  /** Ação sugerida pelo pilar 4 */
  action: 'auto_merge' | 'pending_review' | 'signal_only';
};

function normId(v?: string | null): string {
  return (v || '').replace(/\D/g, '');
}

function normName(v?: string | null): string {
  return (v || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Similaridade simples 0–1 (tokens em comum). */
export function nameSimilarity(a?: string | null, b?: string | null): number {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = new Set(na.split(' ').filter((t) => t.length > 1));
  const tb = new Set(nb.split(' ').filter((t) => t.length > 1));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / Math.max(ta.size, tb.size);
}

/**
 * Avalia se duas pessoas são o mesmo Paciente Mestre.
 */
export function evaluatePatientMatch(left: MatchPerson, right: MatchPerson): MatchResult {
  const evidence: string[] = [];
  const cpfL = normId(left.cpf);
  const cpfR = normId(right.cpf);
  const cnsL = normId(left.cns);
  const cnsR = normId(right.cns);
  const sameDn = !!(left.birthDate && right.birthDate && left.birthDate === right.birthDate);
  const sim = nameSimilarity(left.civilName, right.civilName);
  const motherSim = nameSimilarity(left.motherName, right.motherName);

  if (cpfL && cpfR && cpfL.length === 11 && cpfL === cpfR) {
    if (left.birthDate && right.birthDate && left.birthDate !== right.birthDate) {
      evidence.push('cpf_igual_dn_conflito');
      return { confidence: 'LOW', score: 0.2, evidence, action: 'signal_only' };
    }
    evidence.push('cpf_identico');
    return { confidence: 'HIGH', score: 0.99, evidence, action: 'auto_merge' };
  }

  if (cnsL && cnsR && cnsL.length === 15 && cnsL === cnsR) {
    evidence.push('cns_identico');
    return { confidence: 'HIGH', score: 0.98, evidence, action: 'auto_merge' };
  }

  if (sameDn && sim >= 0.7 && (motherSim >= 0.6 || (cnsL && cnsR && cnsL.slice(0, 11) === cnsR.slice(0, 11)))) {
    evidence.push('dn_nome_mae_ou_cns_parcial', `nameSim=${sim.toFixed(2)}`);
    return { confidence: 'MEDIUM', score: 0.75, evidence, action: 'pending_review' };
  }

  if (sameDn && sim >= 0.85) {
    evidence.push('dn_nome_forte', `nameSim=${sim.toFixed(2)}`);
    return { confidence: 'MEDIUM', score: 0.7, evidence, action: 'pending_review' };
  }

  if (sameDn && sim >= 0.4) {
    evidence.push('dn_nome_fraco', `nameSim=${sim.toFixed(2)}`);
    return { confidence: 'LOW', score: 0.35, evidence, action: 'signal_only' };
  }

  evidence.push('sem_evidencia_forte');
  return { confidence: 'LOW', score: 0.1, evidence, action: 'signal_only' };
}

export function actionForConfidence(c: MatchConfidence): MatchResult['action'] {
  if (c === 'HIGH') return 'auto_merge';
  if (c === 'MEDIUM') return 'pending_review';
  return 'signal_only';
}
