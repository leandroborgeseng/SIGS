import {
  ibge7ToMunicipio6,
  mapApiEstablishment,
  parseCnesWebEquipesHtml,
  parseCnesWebEquipesListHtml,
} from './cnes.parser';
import { annotateMunicipalNetwork, CNES_GESTAO_CRITERION } from './cnes.filter';
import type { CnesSnapshot, CnesTeam } from './cnes.types';

const API_BASE = process.env.CNES_API_BASE || 'https://apidadosabertos.saude.gov.br';
const CNESWEB_BASE = process.env.CNESWEB_BASE || 'http://cnes2.datasus.gov.br';

async function httpGetText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'SIGS-CNES-Sync/1.0 (+https://github.com/local/sigs)' },
    signal: AbortSignal.timeout(Number(process.env.CNES_FETCH_TIMEOUT_MS || 60000)),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
  return res.text();
}

async function httpGetJson<T>(url: string): Promise<T> {
  const text = await httpGetText(url);
  return JSON.parse(text) as T;
}

/** Busca estabelecimentos (API Dados Abertos) + equipes (CnesWeb) por IBGE 7 dígitos. */
export async function fetchLiveCnesSnapshot(ibgeCode: string): Promise<CnesSnapshot> {
  const mun6 = ibge7ToMunicipio6(ibgeCode);
  const establishments = [];
  const limit = 20;
  let offset = 0;
  for (;;) {
    const url = `${API_BASE}/cnes/estabelecimentos?codigo_municipio=${mun6}&limit=${limit}&offset=${offset}`;
    const page = await httpGetJson<{ estabelecimentos?: unknown[] }>(url);
    const rows = page.estabelecimentos || [];
    if (!rows.length) break;
    for (const row of rows) establishments.push(mapApiEstablishment(row, ibgeCode));
    if (rows.length < limit) break;
    offset += limit;
  }

  const listHtml = await httpGetText(
    `${CNESWEB_BASE}/Mod_Ind_Equipes_Listar.asp?VEstado=${ibgeCode.slice(0, 2)}&VMun=${mun6}`,
  );
  const units = parseCnesWebEquipesListHtml(listHtml);
  const teams: CnesTeam[] = [];
  for (const u of units) {
    const page = await httpGetText(`${CNESWEB_BASE}/Mod_Equipes.asp?VCo_Unidade=${u.unidade}`);
    teams.push(...parseCnesWebEquipesHtml(u.cnes, page));
  }

  return annotateMunicipalNetwork({
    meta: {
      ibgeCode,
      municipality: ibgeCode === '3516200' ? 'Franca' : undefined,
      uf: ibgeCode.slice(0, 2) === '35' ? 'SP' : undefined,
      sourceEstablishments: `${API_BASE}/cnes/estabelecimentos`,
      sourceTeams: `${CNESWEB_BASE}/Mod_Ind_Equipes_Listar.asp`,
      generatedAt: new Date().toISOString(),
      gestaoCriterion: CNES_GESTAO_CRITERION,
      competenciaHint: 'API Dados Abertos + CnesWeb (sem PHI)',
    },
    establishments,
    teams,
  });
}
