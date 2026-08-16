import { assertIbgeCode } from '../ledi/ibge';
import {
  isMunicipalPrefeituraNetwork,
  normalizeNaturezaJuridicaCode,
} from './cnes.filter';
import type { CnesEstablishment, CnesSnapshot, CnesTeam } from './cnes.types';

export function padCnes(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return null;
  return digits.padStart(7, '0').slice(-7);
}

export function padIne(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return null;
  return digits.padStart(10, '0').slice(-10);
}

export function ibge7ToMunicipio6(ibge7: string): string {
  const code = assertIbgeCode(ibge7);
  if (!code) throw new Error('IBGE inválido');
  return code.slice(0, 6);
}

/** Aceita snapshot já normalizado ou payload cru da API Dados Abertos. */
export function parseCnesSnapshot(raw: unknown, fallbackIbge = '3516200'): CnesSnapshot {
  if (!raw || typeof raw !== 'object') {
    throw new Error('snapshot CNES inválido');
  }
  const obj = raw as Record<string, unknown>;

  if (Array.isArray(obj.establishments) || Array.isArray(obj.teams)) {
    return normalizeNormalized(obj, fallbackIbge);
  }

  if (Array.isArray(obj.estabelecimentos)) {
    const ibge = assertIbgeCode(String(obj.ibgeCode || fallbackIbge)) || fallbackIbge;
    const establishments = (obj.estabelecimentos as unknown[]).map((row) =>
      mapApiEstablishment(row, ibge),
    );
    const teams = Array.isArray(obj.equipes)
      ? (obj.equipes as unknown[]).map(mapLooseTeam).filter(Boolean) as CnesTeam[]
      : [];
    return {
      meta: {
        ibgeCode: ibge,
        sourceEstablishments: 'api-dados-abertos',
        counts: {
          establishments: establishments.length,
          teams: teams.length,
          establishmentsActive: establishments.filter((e) => e.active).length,
        },
      },
      establishments,
      teams,
    };
  }

  throw new Error('formato de snapshot CNES não reconhecido');
}

function normalizeNormalized(obj: Record<string, unknown>, fallbackIbge: string): CnesSnapshot {
  const metaIn = (obj.meta && typeof obj.meta === 'object' ? obj.meta : {}) as Record<string, unknown>;
  const ibge =
    assertIbgeCode(String(metaIn.ibgeCode || obj.ibgeCode || fallbackIbge)) || fallbackIbge;

  const establishments = (Array.isArray(obj.establishments) ? obj.establishments : [])
    .map((row) => mapNormalizedEstablishment(row, ibge))
    .filter((e): e is CnesEstablishment => !!e);

  const teams = (Array.isArray(obj.teams) ? obj.teams : [])
    .map(mapLooseTeam)
    .filter((t): t is CnesTeam => !!t);

  return {
    meta: {
      ibgeCode: ibge,
      municipality: metaIn.municipality ? String(metaIn.municipality) : undefined,
      uf: metaIn.uf ? String(metaIn.uf) : undefined,
      sourceEstablishments: metaIn.sourceEstablishments
        ? String(metaIn.sourceEstablishments)
        : undefined,
      sourceTeams: metaIn.sourceTeams ? String(metaIn.sourceTeams) : undefined,
      generatedAt: metaIn.generatedAt ? String(metaIn.generatedAt) : undefined,
      gestaoCriterion: metaIn.gestaoCriterion ? String(metaIn.gestaoCriterion) : undefined,
      gestaoFilter: metaIn.gestaoFilter ? String(metaIn.gestaoFilter) : undefined,
      counts: {
        establishments: establishments.length,
        teams: teams.length,
        establishmentsActive: establishments.filter((e) => e.active).length,
        establishmentsCity:
          metaIn.counts && typeof metaIn.counts === 'object'
            ? Number((metaIn.counts as Record<string, unknown>).establishmentsCity) || undefined
            : undefined,
        teamsCity:
          metaIn.counts && typeof metaIn.counts === 'object'
            ? Number((metaIn.counts as Record<string, unknown>).teamsCity) || undefined
            : undefined,
        establishmentsMunicipal:
          metaIn.counts && typeof metaIn.counts === 'object'
            ? Number((metaIn.counts as Record<string, unknown>).establishmentsMunicipal) ||
              undefined
            : undefined,
        teamsMunicipal:
          metaIn.counts && typeof metaIn.counts === 'object'
            ? Number((metaIn.counts as Record<string, unknown>).teamsMunicipal) || undefined
            : undefined,
        establishmentsMunicipalActive:
          metaIn.counts && typeof metaIn.counts === 'object'
            ? Number((metaIn.counts as Record<string, unknown>).establishmentsMunicipalActive) ||
              undefined
            : undefined,
      },
    },
    establishments,
    teams,
  };
}

function mapNormalizedEstablishment(row: unknown, ibge: string): CnesEstablishment | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const cnes = padCnes(r.cnes);
  if (!cnes) return null;
  const name = String(r.name || `CNES ${cnes}`).trim();
  const addr = r.address && typeof r.address === 'object' ? (r.address as Record<string, unknown>) : null;
  const naturezaJuridica =
    normalizeNaturezaJuridicaCode(r.naturezaJuridica) ||
    normalizeNaturezaJuridicaCode(r.descricao_natureza_juridica_estabelecimento);
  const base: CnesEstablishment = {
    cnes,
    name,
    typeId: r.typeId != null ? String(r.typeId) : null,
    cnpj: r.cnpj != null && String(r.cnpj).trim() ? String(r.cnpj).replace(/\D/g, '').slice(0, 14) : null,
    active: r.active !== false,
    ibgeCode: assertIbgeCode(String(r.ibgeCode || ibge)) || ibge,
    address: addr
      ? {
          street: addr.street != null ? String(addr.street) : null,
          number: addr.number != null ? String(addr.number) : null,
          neighborhood: addr.neighborhood != null ? String(addr.neighborhood) : null,
          city: addr.city != null ? String(addr.city) : null,
          state: addr.state != null ? String(addr.state) : null,
          zip: addr.zip != null ? String(addr.zip).replace(/\D/g, '').slice(0, 8) : null,
        }
      : null,
    tipoGestao: r.tipoGestao != null ? String(r.tipoGestao).trim() || null : r.tipo_gestao != null ? String(r.tipo_gestao).trim() || null : null,
    esferaAdministrativa:
      r.esferaAdministrativa != null
        ? String(r.esferaAdministrativa).trim() || null
        : r.descricao_esfera_administrativa != null
          ? String(r.descricao_esfera_administrativa).trim() || null
          : null,
    naturezaJuridica,
    razaoSocial: r.razaoSocial != null ? String(r.razaoSocial).trim() || null : null,
  };
  base.municipalNetwork =
    r.municipalNetwork === true || r.municipalNetwork === false
      ? Boolean(r.municipalNetwork)
      : isMunicipalPrefeituraNetwork(base);
  return base;
}

export function mapApiEstablishment(row: unknown, ibge7: string): CnesEstablishment {
  const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
  const cnes = padCnes(r.codigo_cnes || r.cnes) || '0000000';
  const desab = String(r.codigo_motivo_desabilitacao_estabelecimento || '').trim();
  const name = String(r.nome_fantasia || r.nome_razao_social || r.name || `CNES ${cnes}`).trim();
  const cep = String(r.codigo_cep_estabelecimento || r.cep || '').replace(/\D/g, '');
  const naturezaJuridica = normalizeNaturezaJuridicaCode(
    r.descricao_natureza_juridica_estabelecimento ?? r.naturezaJuridica,
  );
  const base: CnesEstablishment = {
    cnes,
    name,
    typeId: r.codigo_tipo_unidade != null ? String(r.codigo_tipo_unidade) : r.typeId != null ? String(r.typeId) : null,
    cnpj: r.numero_cnpj != null ? String(r.numero_cnpj).replace(/\D/g, '').slice(0, 14) || null : null,
    active: !desab,
    ibgeCode: ibge7,
    address: {
      street: r.endereco_estabelecimento != null ? String(r.endereco_estabelecimento) : null,
      number: r.numero_estabelecimento != null ? String(r.numero_estabelecimento) : null,
      neighborhood: r.bairro_estabelecimento != null ? String(r.bairro_estabelecimento) : null,
      city: ibge7 === '3516200' ? 'Franca' : null,
      state: ibge7.startsWith('35') ? 'SP' : null,
      zip: cep ? cep.padStart(8, '0').slice(-8) : null,
    },
    tipoGestao: r.tipo_gestao != null ? String(r.tipo_gestao).trim() || null : null,
    esferaAdministrativa:
      r.descricao_esfera_administrativa != null
        ? String(r.descricao_esfera_administrativa).trim() || null
        : null,
    naturezaJuridica,
    razaoSocial: r.nome_razao_social != null ? String(r.nome_razao_social).trim() || null : null,
  };
  base.municipalNetwork = isMunicipalPrefeituraNetwork(base);
  return base;
}

function mapLooseTeam(row: unknown): CnesTeam | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const cnes = padCnes(r.cnes);
  const ine = padIne(r.ine);
  if (!cnes || !ine) return null;
  const teamTypeId = String(r.teamTypeId || r.tipo || '0').trim() || '0';
  const name = String(r.name || r.teamTypeLabel || `Equipe ${ine}`).trim();
  return {
    cnes,
    ine,
    name,
    teamTypeId,
    teamTypeLabel: r.teamTypeLabel != null ? String(r.teamTypeLabel) : null,
    area: r.area != null ? String(r.area) : null,
    active: r.active !== false,
  };
}

/** Parse HTML CnesWeb Mod_Equipes.asp (INE + tipo + nome). */
export function parseCnesWebEquipesHtml(cnes: string, html: string): CnesTeam[] {
  const padded = padCnes(cnes);
  if (!padded) return [];
  const rowPat =
    /Mod_Equipes_Profisssional\.asp\?[^"]*VTipo=(\d+)[^"]*"[^>]*>([^<]+)<\/a><\/font><\/td>\s*<td[^>]*>\s*<font[^>]*>\s*(\d{7,12})\s*<\/font><\/td>\s*<td[^>]*>\s*<font[^>]*>\s*([^<]*?)\s*<\/font><\/td>/gi;
  const out: CnesTeam[] = [];
  let m: RegExpExecArray | null;
  while ((m = rowPat.exec(html))) {
    const ine = padIne(m[3]);
    if (!ine) continue;
    const tipoLabel = decodeHtml(m[2].trim());
    const nome = decodeHtml(m[4].trim()) || tipoLabel;
    out.push({
      cnes: padded,
      ine,
      name: nome,
      teamTypeId: m[1],
      teamTypeLabel: tipoLabel,
      active: true,
    });
  }
  return out;
}

export function parseCnesWebEquipesListHtml(html: string): Array<{ unidade: string; cnes: string; label: string }> {
  const re = /Mod_Equipes\.asp\?VCo_Unidade=(\d+)"[^>]*>([^<]+)<\/a>/gi;
  const out: Array<{ unidade: string; cnes: string; label: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const unidade = m[1];
    const cnes = padCnes(unidade.slice(-7));
    if (!cnes) continue;
    out.push({ unidade, cnes, label: decodeHtml(m[2].trim()) });
  }
  return out;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
