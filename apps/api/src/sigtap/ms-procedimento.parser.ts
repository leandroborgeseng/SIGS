/**
 * Parser mínimo do layout oficial DATASUS SIGTAP — TB_PROCEDIMENTO.txt
 * (largura fixa; posições alinhadas ao layout público da Tabela Unificada).
 *
 * co_procedimento  : 1–10
 * no_procedimento  : 11–260
 * dt_competencia   : 325–330 (YYYYMM)
 *
 * Não baixa automaticamente do MS — o município anexa o arquivo da competência.
 */

export type MsProcedimentoRow = {
  code: string;
  name: string;
  groupCode: string;
  groupName?: string;
  complex?: string;
  competencia: string;
};

const NAME_START = 10; // 0-based; chars 11–260
const NAME_END = 260;
const COMP_START = 324; // chars 325–330
const COMP_END = 330;

export function parseTbProcedimentoLine(line: string): MsProcedimentoRow | null {
  const raw = line.replace(/\r$/, '');
  if (!raw.trim()) return null;
  // Ignora cabeçalhos / layouts CSV
  if (raw.toLowerCase().includes('co_procedimento') || raw.startsWith('Inicio,')) return null;
  if (raw.length < 10) return null;

  const code = raw.slice(0, 10).trim();
  if (!/^\d{9,10}$/.test(code)) return null;

  const name =
    raw.length >= NAME_END
      ? raw.slice(NAME_START, NAME_END).trim()
      : raw.slice(NAME_START).trim();
  if (!name) return null;

  let competencia = '';
  if (raw.length >= COMP_END) {
    competencia = raw.slice(COMP_START, COMP_END).trim();
  }
  if (!/^\d{6}$/.test(competencia)) competencia = '';

  return {
    code,
    name,
    groupCode: code.slice(0, 2),
    competencia,
  };
}

export function parseTbProcedimentoText(
  content: string,
  opts?: { competenciaFallback?: string; maxRows?: number },
): { rows: MsProcedimentoRow[]; skipped: number; detectedCompetencia?: string } {
  const maxRows = opts?.maxRows ?? 50_000;
  const lines = content.split(/\n/);
  const rows: MsProcedimentoRow[] = [];
  let skipped = 0;
  const comps = new Map<string, number>();

  for (const line of lines) {
    if (rows.length >= maxRows) break;
    const parsed = parseTbProcedimentoLine(line);
    if (!parsed) {
      if (line.trim()) skipped += 1;
      continue;
    }
    if (!parsed.competencia && opts?.competenciaFallback) {
      parsed.competencia = opts.competenciaFallback;
    }
    if (parsed.competencia) {
      comps.set(parsed.competencia, (comps.get(parsed.competencia) || 0) + 1);
    }
    rows.push(parsed);
  }

  let detectedCompetencia: string | undefined;
  let best = 0;
  for (const [c, n] of comps) {
    if (n > best) {
      best = n;
      detectedCompetencia = c;
    }
  }

  return { rows, skipped, detectedCompetencia };
}
