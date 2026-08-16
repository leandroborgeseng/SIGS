import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { parseCnesSnapshot } from './cnes.parser';
import { padCnes, padIne } from './cnes.parser';
import type { CnesSnapshot } from './cnes.types';

export const FRANCA_IBGE = '3516200';

/** Alias: CNES útil = 7 dígitos (padCnes do parser). */
export function normalizeCnes(raw: string | null | undefined): string | null {
  return padCnes(raw);
}

/** CNES útil = exatamente 7 dígitos (sem pad inventado). */
export function isValidCnesFormat(raw: string | null | undefined): boolean {
  if (raw == null || raw === '') return false;
  const digits = String(raw).replace(/\D/g, '');
  return digits.length === 7;
}

export function normalizeIne(raw: string | null | undefined): string | null {
  return padIne(raw);
}

function candidateSnapshotPaths(ibgeCode: string): string[] {
  const env = process.env.CNES_SNAPSHOT_PATH?.trim();
  const file = `franca-${ibgeCode}.json`;
  const roots = [
    process.env.CNES_DATA_DIR,
    join(process.cwd(), 'data', 'cnes'),
    join(process.cwd(), '..', '..', 'data', 'cnes'),
    join(__dirname, '..', '..', '..', '..', 'data', 'cnes'),
    join(__dirname, '..', '..', '..', '..', '..', 'data', 'cnes'),
  ].filter(Boolean) as string[];

  const paths: string[] = [];
  if (env) paths.push(resolve(env));
  for (const root of roots) {
    paths.push(resolve(root, file));
    paths.push(resolve(root, `${ibgeCode}.json`));
  }
  return [...new Set(paths)];
}

export function resolveCnesSnapshotPath(ibgeCode: string = FRANCA_IBGE): string | null {
  for (const p of candidateSnapshotPaths(ibgeCode)) {
    if (existsSync(p)) return p;
  }
  return null;
}

export function loadCnesSnapshotFromPath(path: string): CnesSnapshot {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  return parseCnesSnapshot(raw);
}

/** API usada pelo sync (CnesService / CLI). */
export function loadBundledSnapshot(ibgeCode: string = FRANCA_IBGE): {
  snapshot: CnesSnapshot;
  path: string;
} {
  const path = resolveCnesSnapshotPath(ibgeCode);
  if (!path) {
    throw new Error(
      `Snapshot CNES não encontrado para IBGE ${ibgeCode}. Defina CNES_SNAPSHOT_PATH ou version data/cnes/franca-${ibgeCode}.json`,
    );
  }
  return { snapshot: loadCnesSnapshotFromPath(path), path };
}

/**
 * Heurística documentada: tipos de equipe APS (eSF/eAP/eSB/eMulti/NASF…)
 * esperam unidade de atenção básica / posto / centro de saúde — não consultório isolado.
 *
 * Códigos CNES de estabelecimento (subset):
 * - 01 Posto de Saúde, 02 Centro de Saúde/UBS, 15 Unidade Mista, 32/40/42 móveis,
 *   70–74, 43 Policlínica (tolerado)
 * - 22 Consultório isolado — incompatível com equipe APS territorial
 *
 * Tipos de equipe (CnesWeb / e-SUS):
 * - 70 eSF, 71 eSB, 72 NASF, 73 eMulti, 74 eCR, 76 eAP
 */
export const APS_TEAM_TYPE_IDS = new Set(['70', '71', '72', '73', '74', '76']);
export const APS_COMPATIBLE_FACILITY_TYPE_IDS = new Set([
  '1',
  '01',
  '2',
  '02',
  '15',
  '32',
  '40',
  '42',
  '43',
  '70',
  '71',
  '72',
  '74',
]);
export const APS_INCOMPATIBLE_FACILITY_TYPE_IDS = new Set(['22']);

export function teamFacilityTypeMismatch(
  teamTypeId: string | null | undefined,
  facilityTypeId: string | null | undefined,
): boolean {
  if (!teamTypeId || !facilityTypeId) return false;
  const tt = String(teamTypeId);
  const ft = String(facilityTypeId);
  if (!APS_TEAM_TYPE_IDS.has(tt)) return false;
  if (APS_INCOMPATIBLE_FACILITY_TYPE_IDS.has(ft)) return true;
  if (APS_COMPATIBLE_FACILITY_TYPE_IDS.has(ft)) return false;
  return false;
}
