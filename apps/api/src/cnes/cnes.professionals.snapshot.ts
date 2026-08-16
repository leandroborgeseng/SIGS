import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import type { CnesProfessionalsSnapshot } from './cnes.professionals.types';
import { FRANCA_IBGE } from './cnes.snapshot';

function candidatePaths(ibgeCode: string): string[] {
  const env = process.env.CNES_PROFESSIONALS_SNAPSHOT_PATH?.trim();
  const file = `franca-${ibgeCode}-professionals.json`;
  const roots = [
    process.env.CNES_DATA_DIR,
    '/app/data/cnes',
    join(process.cwd(), 'data', 'cnes'),
    join(process.cwd(), '..', '..', 'data', 'cnes'),
    join(process.cwd(), '..', 'data', 'cnes'),
    join(__dirname, 'snapshots'),
    join(__dirname, '..', '..', '..', '..', 'data', 'cnes'),
  ].filter(Boolean) as string[];
  const paths: string[] = [];
  if (env) paths.push(resolve(env));
  for (const root of roots) paths.push(resolve(root, file));
  return [...new Set(paths)];
}

export function resolveProfessionalsSnapshotPath(ibgeCode: string = FRANCA_IBGE): string | null {
  for (const p of candidatePaths(ibgeCode)) {
    if (existsSync(p)) return p;
  }
  return null;
}

export function loadProfessionalsSnapshot(ibgeCode: string = FRANCA_IBGE): {
  snapshot: CnesProfessionalsSnapshot;
  path: string;
} {
  const path = resolveProfessionalsSnapshotPath(ibgeCode);
  if (!path) {
    throw new Error(
      `Snapshot profissionais CNES não encontrado (franca-${ibgeCode}-professionals.json). Rode a coleta CnesWeb ou defina CNES_PROFESSIONALS_SNAPSHOT_PATH.`,
    );
  }
  const raw = JSON.parse(readFileSync(path, 'utf8')) as CnesProfessionalsSnapshot;
  if (!Array.isArray(raw.professionals) || !Array.isArray(raw.assignments)) {
    throw new Error('snapshot profissionais inválido');
  }
  return { snapshot: raw, path };
}

/** Parse HTML CnesWeb Mod_Equipes_Profisssional.asp → linhas nome/CNS/CBO/atividade. */
export function parseCnesWebProfessionalsHtml(html: string): Array<{
  civilName: string;
  cns: string;
  cbo: string;
  roleLabel: string | null;
}> {
  const rowRe =
    /<tr[^>]*>\s*<td[^>]*>\s*<font[^>]*>\s*([^<]+?)\s*<\/font>\s*<\/td>\s*<td[^>]*>\s*<font[^>]*>\s*(\d{15})\s*<\/font>\s*<\/td>\s*<td[^>]*>\s*<font[^>]*>\s*(\d{4,6})\s*<\/font>\s*<\/td>\s*<td[^>]*>\s*<font[^>]*>\s*([^<]*?)\s*<\/font>/gi;
  const out: Array<{ civilName: string; cns: string; cbo: string; roleLabel: string | null }> = [];
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html))) {
    const civilName = m[1].replace(/\s+/g, ' ').trim();
    const cns = m[2];
    const cbo = m[3].replace(/\D/g, '').padStart(6, '0').slice(-6);
    const roleLabel = m[4].replace(/\s+/g, ' ').trim() || null;
    if (!civilName || !cns) continue;
    out.push({ civilName, cns, cbo, roleLabel });
  }
  return out;
}
