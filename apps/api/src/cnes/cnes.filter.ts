import type { CnesEstablishment, CnesSnapshot, CnesSyncGestao } from './cnes.types';

/**
 * Critério oficial SIGS — rede municipal (gestão Prefeitura de Franca).
 *
 * Campo mais confiável na API Dados Abertos CNES:
 *   `descricao_natureza_juridica_estabelecimento` = **1244** (Município)
 *
 * Em Franca/IBGE 3516200 isso coincide 100% com razão social
 * «PREFEITURA MUNICIPAL DE FRANCA» / «MUNICIPIO DE FRANCA».
 *
 * NÃO usar só `tipo_gestao=M` / esfera MUNICIPAL: quase todos os CNES do
 * município (particulares inclusos) ficam sob gestão territorial municipal.
 *
 * CNPJ do estabelecimento (`numero_cnpj`) vem **nulo** para os 66 CNES 1244
 * no snapshot. CNPJ oficial da mantenedora (portal Prefeitura):
 *   **47.970.769/0001-04** → `47970769000104`
 * Usado como enriquecimento / filtro alinhado (não substitui natureza 1244).
 */
export const MUNICIPAL_NATUREZA_JURIDICA_CODES = new Set(['1244']);

/** CNPJ oficial Município/Prefeitura de Franca (portal franca.sp.gov.br). */
export const PREFEITURA_FRANCA_CNPJ = '47970769000104';

export const PREFEITURA_MANTENEDORA_CNPJS = new Set([PREFEITURA_FRANCA_CNPJ]);

export const CNES_GESTAO_CRITERION =
  'naturezaJuridica=1244 (Município) — Prefeitura/Município de Franca; CNPJ mantenedora 47970769000104 (enriquecimento; CNES numero_cnpj nulo na rede 1244); não usar só tipo_gestao=M';

export function normalizeCnpjDigits(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  const digits = String(raw).replace(/\D/g, '');
  return digits.length >= 14 ? digits.slice(0, 14) : digits.length ? digits : null;
}

/** Alias UI/API: prefeitura | municipio | mantenedora → CNPJ Franca. */
export function resolveCnpjFilter(raw?: string | null): string | null {
  if (raw == null || String(raw).trim() === '') return null;
  const v = String(raw).trim().toLowerCase();
  if (
    v === 'prefeitura' ||
    v === 'municipio' ||
    v === 'mantenedora' ||
    v === 'prefeitura-franca' ||
    v === 'prefeitura_franca'
  ) {
    return PREFEITURA_FRANCA_CNPJ;
  }
  return normalizeCnpjDigits(raw);
}

export function normalizeNaturezaJuridicaCode(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  // códigos vêm como "1244" ou "1.244" / com DV "1244-0"
  return digits.slice(0, 4);
}

export function parseGestaoMode(
  raw?: string | null,
  somentePrefeitura?: boolean | string | null,
): CnesSyncGestao {
  if (somentePrefeitura === false || somentePrefeitura === '0' || somentePrefeitura === 'false') {
    return 'todos';
  }
  if (somentePrefeitura === true || somentePrefeitura === '1' || somentePrefeitura === 'true') {
    return 'municipal';
  }
  const v = String(raw || 'municipal')
    .trim()
    .toLowerCase();
  if (v === 'todos' || v === 'all' || v === 'cidade' || v === 'completo') return 'todos';
  if (
    v === 'municipal' ||
    v === 'prefeitura' ||
    v === 'somenteprefeitura' ||
    v === 'rede-municipal' ||
    v === 'rede_municipal'
  ) {
    return 'municipal';
  }
  return 'municipal';
}

/** Heurística de nome só como fallback se o snapshot antigo não tiver natureza. */
export function looksLikePrefeituraMantenedora(est: {
  name?: string | null;
  razaoSocial?: string | null;
}): boolean {
  const blob = `${est.razaoSocial || ''} ${est.name || ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  return (
    blob.includes('PREFEITURA MUNICIPAL DE FRANCA') ||
    blob.includes('MUNICIPIO DE FRANCA') ||
    blob.includes('PREFEITURA DE FRANCA')
  );
}

export function isMunicipalPrefeituraNetwork(est: CnesEstablishment): boolean {
  if (est.municipalNetwork === true) return true;
  if (est.municipalNetwork === false) return false;
  const code = normalizeNaturezaJuridicaCode(est.naturezaJuridica);
  if (code) return MUNICIPAL_NATUREZA_JURIDICA_CODES.has(code);
  return looksLikePrefeituraMantenedora(est);
}

/**
 * CNPJ efetivo para persistência: usa o do estabelecimento; se rede municipal
 * e CNES sem CNPJ, preenche com CNPJ oficial da Prefeitura (mantenedora).
 */
export function resolveFacilityCnpj(est: {
  cnpj?: string | null;
  municipalNetwork?: boolean;
  naturezaJuridica?: string | null;
  name?: string | null;
  razaoSocial?: string | null;
}): string | null {
  const own = normalizeCnpjDigits(est.cnpj);
  if (own) return own;
  if (isMunicipalPrefeituraNetwork(est as CnesEstablishment)) {
    return PREFEITURA_FRANCA_CNPJ;
  }
  return null;
}

export type CnesFilterStats = {
  mode: CnesSyncGestao;
  criterion: string;
  before: { establishments: number; teams: number; establishmentsActive: number };
  after: { establishments: number; teams: number; establishmentsActive: number };
};

export function applyGestaoFilter(
  snapshot: CnesSnapshot,
  gestao: CnesSyncGestao = 'municipal',
): { snapshot: CnesSnapshot; filter: CnesFilterStats } {
  const before = {
    establishments: snapshot.establishments.length,
    teams: snapshot.teams.length,
    establishmentsActive: snapshot.establishments.filter((e) => e.active).length,
  };

  if (gestao === 'todos') {
    return {
      snapshot,
      filter: {
        mode: 'todos',
        criterion: 'sem filtro — todos os CNES do município (IBGE)',
        before,
        after: before,
      },
    };
  }

  const establishments = snapshot.establishments.filter(isMunicipalPrefeituraNetwork);
  const cnesSet = new Set(establishments.map((e) => e.cnes));
  const teams = snapshot.teams.filter((t) => cnesSet.has(t.cnes));
  const after = {
    establishments: establishments.length,
    teams: teams.length,
    establishmentsActive: establishments.filter((e) => e.active).length,
  };

  return {
    snapshot: {
      ...snapshot,
      establishments,
      teams,
      meta: {
        ...snapshot.meta,
        gestaoFilter: 'municipal',
        gestaoCriterion: CNES_GESTAO_CRITERION,
        counts: {
          ...snapshot.meta.counts,
          establishments: after.establishments,
          teams: after.teams,
          establishmentsActive: after.establishmentsActive,
          establishmentsCity: before.establishments,
          teamsCity: before.teams,
          establishmentsMunicipal: after.establishments,
          teamsMunicipal: after.teams,
        },
      },
    },
    filter: {
      mode: 'municipal',
      criterion: CNES_GESTAO_CRITERION,
      before,
      after,
    },
  };
}

/** Marca municipalNetwork em cada estabelecimento (snapshot completo da cidade). */
export function annotateMunicipalNetwork(snapshot: CnesSnapshot): CnesSnapshot {
  const establishments = snapshot.establishments.map((e) => {
    const municipalNetwork = isMunicipalPrefeituraNetwork({
      ...e,
      municipalNetwork: undefined,
    });
    return { ...e, municipalNetwork };
  });
  const muni = establishments.filter((e) => e.municipalNetwork);
  const cnesSet = new Set(muni.map((e) => e.cnes));
  const teamsMunicipal = snapshot.teams.filter((t) => cnesSet.has(t.cnes)).length;
  return {
    ...snapshot,
    establishments,
    meta: {
      ...snapshot.meta,
      gestaoCriterion: CNES_GESTAO_CRITERION,
      counts: {
        establishments: establishments.length,
        teams: snapshot.teams.length,
        establishmentsActive: establishments.filter((e) => e.active).length,
        establishmentsCity: establishments.length,
        teamsCity: snapshot.teams.length,
        establishmentsMunicipal: muni.length,
        teamsMunicipal,
        establishmentsMunicipalActive: muni.filter((e) => e.active).length,
      },
    },
  };
}
