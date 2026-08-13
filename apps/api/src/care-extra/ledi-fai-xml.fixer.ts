/**
 * Auto-correção LEDI FAI (tipo 4) — só o que é seguro.
 * Não inventa diagnóstico, CID, profissional nem paciente.
 */

import { isValidCns, isValidCpf, type FaoFinding } from './ledi-fao.validator';
import {
  applyAutoFixes,
  escapeXml,
  fixIbge,
  fixLocalAtendimento,
  fixStNaoPossuiCpf,
  fixTpCdsOrigem,
  fixTurno,
  fixUuidFichaLength,
  type AutoFixOptions,
  type AutoFixResult,
} from './ledi-fao-xml.fixer';

/** Defaults municipais documentados (Franca). Não usar para dado clínico. */
export const FAI_SAFE_DEFAULTS = {
  turno: 2,
  localAtendimento: 1,
  ibge: '3516200',
  tpCdsOrigem: 3,
  /** Só sugestão na UI — nunca aplicar em lote sem o profissional escolher. */
  condutaSugerida: 1,
  tipoAtendimentoSugerido: 5,
} as const;

/** Códigos FAI com auto-fix seguro (zero-input ou default documentado / input de lotação). */
export const FAI_AUTO_FIXABLE_CODES = new Set([
  'ST_NAO_POSSUI_CPF',
  'JUSTIFICATIVA_CPF_MISSING',
  'INE_MISSING',
  'TURNO',
  'LOCAL_ATENDIMENTO',
  'CNES_MISSING',
  'CNES_FORMAT',
  'IBGE_MISSING',
  'IBGE_FORMAT',
  'TP_CDS_ORIGEM_MISSING',
  'TP_CDS_ORIGEM_NOT_3',
  'PROC_QTD',
  'CONDUTAS_MAX',
  'UUID_FICHA_LENGTH',
  'UUID_FICHA_CASE',
  'XML_ENCODING',
  'CNS_FORMAT',
  'CPF_FORMAT',
  'CIAP_FORMAT',
  'CID_FORMAT',
]);

/** BLOCKER clínico: UI sugere, não aplica em lote. */
export const FAI_SUGGEST_ONLY_CODES = new Set([
  'CONDUTA_MISSING',
  'PROBLEMAS_MISSING',
  'PROBLEMA_SEM_CODIGO',
  'TIPO_ATENDIMENTO',
  'SEXO_INVALID',
  'PATIENT_ID_MISSING',
  'CNS_INVALID',
  'CPF_INVALID',
  'DT_NASCIMENTO_MISSING',
  'DATA_ATENDIMENTO_MISSING',
  'PROF_CNS_MISSING',
  'PROF_CNS_INVALID',
  'DT_NASCIMENTO_AFTER_ATEND',
]);

const FAI_CONDUTA_OK = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
const FAI_TIPO_OK = new Set([1, 2, 4, 5, 6]);

export function classifyFaiAutoFixable(findings: FaoFinding[]): string[] {
  const codes = new Set<string>();
  for (const f of findings) {
    if (FAI_AUTO_FIXABLE_CODES.has(f.code)) codes.add(f.code);
  }
  return [...codes];
}

function replaceTagText(xml: string, tag: string, nextVal: string): { xml: string; changed: boolean } {
  const re = new RegExp(`(<${tag}\\b[^>]*>)([^<]*)(</${tag}>)`, 'gi');
  let changed = false;
  const out = xml.replace(re, (_m, open: string, inner: string, close: string) => {
    if (inner === nextVal) return `${open}${inner}${close}`;
    changed = true;
    return `${open}${nextVal}${close}`;
  });
  return { xml: out, changed };
}

export function fixXmlEncoding(xml: string): { xml: string; changed: boolean } {
  const decl = xml.match(/<\?xml\b[^?]*\?>/i);
  if (!decl) {
    return { xml: `<?xml version="1.0" encoding="utf-8"?>\n${xml}`, changed: true };
  }
  if (/encoding\s*=\s*["']utf-8["']/i.test(decl[0])) return { xml, changed: false };
  const nextDecl = /encoding\s*=/i.test(decl[0])
    ? decl[0].replace(/encoding\s*=\s*["'][^"']*["']/i, 'encoding="utf-8"')
    : decl[0].replace(/\?>/, ' encoding="utf-8"?>');
  return { xml: xml.replace(decl[0], nextDecl), changed: true };
}

export function fixUuidFichaCase(xml: string): { xml: string; changed: boolean } {
  const m = xml.match(/<uuidFicha\b[^>]*>\s*([^<]*?)\s*<\/uuidFicha>/i);
  if (!m) return { xml, changed: false };
  const cur = m[1];
  const next = cur.trim().toUpperCase();
  if (cur === next) return { xml, changed: false };
  return replaceTagText(xml, 'uuidFicha', next);
}

/** CNS/CPF: só dígitos quando o checksum já fecha — nunca inventa identificador. */
export function fixCitizenIdDigits(xml: string): { xml: string; changed: boolean } {
  let changed = false;
  let next = xml;
  next = next.replace(
    /<(cnsCidadao|cns|profissionalCNS)\b[^>]*>\s*([^<]*?)\s*<\/\1>/gi,
    (full, tag: string, raw: string) => {
      const digits = String(raw).replace(/\D/g, '');
      if (digits === raw.trim()) return full;
      if (!isValidCns(digits)) return full;
      changed = true;
      return `<${tag}>${digits}</${tag}>`;
    },
  );
  next = next.replace(/<cpfCidadao\b[^>]*>\s*([^<]*?)\s*<\/cpfCidadao>/gi, (full, raw: string) => {
    const digits = String(raw).replace(/\D/g, '');
    if (digits === raw.trim()) return full;
    if (!isValidCpf(digits)) return full;
    changed = true;
    return `<cpfCidadao>${digits}</cpfCidadao>`;
  });
  return { xml: next, changed };
}

export function fixCiapFormat(xml: string): { xml: string; changed: boolean } {
  let changed = false;
  const next = xml.replace(
    /<(ciap2MotivoConsulta|ciap)\b[^>]*>\s*([^<]*?)\s*<\/\1>/gi,
    (full, tag: string, raw: string) => {
      const norm = String(raw).trim().toUpperCase().replace(/\s+/g, '');
      if (!/^[A-Z]\d{2}$/.test(norm) || norm === raw) return full;
      changed = true;
      return `<${tag}>${escapeXml(norm)}</${tag}>`;
    },
  );
  return { xml: next, changed };
}

export function fixCidFormat(xml: string): { xml: string; changed: boolean } {
  let changed = false;
  const next = xml.replace(/<(cid10_2|cid10)\b[^>]*>\s*([^<]*?)\s*<\/\1>/gi, (full, tag: string, raw: string) => {
    const norm = String(raw).trim().toUpperCase().replace(/\s+/g, '');
    if (!/^[A-Z]\d{2,4}(\.\d{1,2})?$/.test(norm) || norm === raw) return full;
    changed = true;
    return `<${tag}>${escapeXml(norm)}</${tag}>`;
  });
  return { xml: next, changed };
}

/** SIGTAP: se sobram 10 dígitos, grava só os dígitos. Não chuta código. */
export function fixProcCodeDigits(xml: string): { xml: string; changed: boolean } {
  let changed = false;
  const next = xml.replace(
    /<(coMsProcedimento|procedimentos)\b[^>]*>\s*([^<]*?)\s*<\/\1>/gi,
    (full, tag: string, raw: string) => {
      const digits = String(raw).replace(/\D/g, '');
      if (digits.length !== 10 || digits === raw.trim()) return full;
      changed = true;
      return `<${tag}>${digits}</${tag}>`;
    },
  );
  return { xml: next, changed };
}

/**
 * Copia INE/CNES do envelope para a lotação quando o envelope já tem valor válido.
 * Não inventa unidade/equipe.
 */
export function copyEnvelopeIneCnesToLotacao(xml: string): { xml: string; changed: boolean } {
  let changed = false;
  let next = xml;
  const envCnes = xml.match(/<cnesDadoSerializado>\s*([^<]+)/i)?.[1]?.replace(/\D/g, '') || '';
  const envIne = xml.match(/<ineDadoSerializado>\s*([^<]+)/i)?.[1]?.replace(/\D/g, '') || '';

  if (envCnes.length === 7) {
    const lotCnes = xml.match(/<lotacaoFormPrincipal[\s\S]*?<cnes>\s*([^<]*)/i)?.[1]?.replace(/\D/g, '') || '';
    if (lotCnes !== envCnes) {
      const r = next.replace(
        /(<lotacaoFormPrincipal\b[^>]*>[\s\S]*?<cnes>)\s*[^<]*(<\/cnes>)/i,
        `$1${envCnes}$2`,
      );
      if (r !== next) {
        next = r;
        changed = true;
      }
    }
  }

  if (envIne.length >= 9) {
    const lotIne = xml.match(/<lotacaoFormPrincipal[\s\S]*?<ine>\s*([^<]*)/i)?.[1]?.replace(/\D/g, '') || '';
    if (!lotIne && /<lotacaoFormPrincipal[\s\S]*?<\/cnes>/i.test(next)) {
      if (/<lotacaoFormPrincipal[\s\S]*?<ine>/i.test(next)) {
        const r = next.replace(
          /(<lotacaoFormPrincipal[\s\S]*?<ine>)\s*(<\/ine>)/i,
          `$1${envIne}$2`,
        );
        if (r !== next) {
          next = r;
          changed = true;
        }
      } else {
        const r = next.replace(
          /(<lotacaoFormPrincipal\b[^>]*>[\s\S]*?<\/cnes>)/i,
          `$1\n<ine>${envIne}</ine>`,
        );
        if (r !== next) {
          next = r;
          changed = true;
        }
      }
    }
  }

  return { xml: next, changed };
}

export function fixCondutasFai(xml: string, codes: number[]): { xml: string; changed: boolean } {
  const want = [...new Set(codes.map(Number).filter((n) => FAI_CONDUTA_OK.has(n)))];
  if (!want.length) return { xml, changed: false };
  const tags = want.map((c) => `<condutas>${c}</condutas>`).join('\n');
  let changed = false;
  const next = xml.replace(
    /(<atendimentosIndividuais\b[^>]*>)([\s\S]*?)(<\/atendimentosIndividuais>)/gi,
    (_m, open: string, body: string, close: string) => {
      changed = true;
      const without = body.replace(/<condutas\b[^>]*>[\s\S]*?<\/condutas>\s*/gi, '');
      if (/<\/tipoAtendimento>/i.test(without)) {
        return `${open}${without.replace(/<\/tipoAtendimento>/i, `</tipoAtendimento>\n${tags}`)}${close}`;
      }
      return `${open}${without}\n${tags}${close}`;
    },
  );
  return { xml: next, changed };
}

export function fixCondutasFaiMax(xml: string, max = 14): { xml: string; changed: boolean } {
  let changed = false;
  const re = /<condutas\b[^>]*>[\s\S]*?<\/condutas>\s*/gi;
  const next = xml.replace(
    /(<atendimentosIndividuais\b[^>]*>)([\s\S]*?)(<\/atendimentosIndividuais>)/gi,
    (_m, open: string, body: string, close: string) => {
      const matches = body.match(re);
      if (!matches || matches.length <= max) return `${open}${body}${close}`;
      changed = true;
      let i = 0;
      const trimmed = body.replace(re, (piece) => {
        i += 1;
        return i <= max ? piece : '';
      });
      return `${open}${trimmed}${close}`;
    },
  );
  return { xml: next, changed };
}

export function fixTipoAtendimentoFai(xml: string, tipo: number): { xml: string; changed: boolean } {
  const n = Number(tipo);
  if (!FAI_TIPO_OK.has(n)) return { xml, changed: false };
  let changed = false;
  const next = xml.replace(
    /(<atendimentosIndividuais\b[^>]*>)([\s\S]*?)(<\/atendimentosIndividuais>)/gi,
    (_m, open: string, body: string, close: string) => {
      if (/<tipoAtendimento\b/i.test(body)) {
        changed = true;
        return `${open}${body.replace(
          /<tipoAtendimento\b[^>]*>[\s\S]*?<\/tipoAtendimento>/i,
          `<tipoAtendimento>${n}</tipoAtendimento>`,
        )}${close}`;
      }
      changed = true;
      if (/<\/localDeAtendimento>/i.test(body)) {
        return `${open}${body.replace(
          /<\/localDeAtendimento>/i,
          `</localDeAtendimento>\n<tipoAtendimento>${n}</tipoAtendimento>`,
        )}${close}`;
      }
      return `${open}${body}\n<tipoAtendimento>${n}</tipoAtendimento>${close}`;
    },
  );
  return { xml: next, changed };
}

export function fixDataNascimentoFai(xml: string, value: string): { xml: string; changed: boolean } {
  const raw = value.trim();
  let epoch: string | null = null;
  if (/^\d{13}$/.test(raw)) epoch = raw;
  else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const t = Date.parse(`${raw}T12:00:00.000Z`);
    if (Number.isFinite(t)) epoch = String(t);
  }
  if (!epoch) return { xml, changed: false };
  if (/<dataNascimento\b/i.test(xml)) return replaceTagText(xml, 'dataNascimento', epoch);
  if (/<dtNascimento\b/i.test(xml)) return replaceTagText(xml, 'dtNascimento', epoch);
  let changed = false;
  const next = xml.replace(
    /(<atendimentosIndividuais\b[^>]*>)([\s\S]*?)(<\/atendimentosIndividuais>)/i,
    (_m, open: string, body: string, close: string) => {
      changed = true;
      if (/<\/cnsCidadao>/i.test(body)) {
        return `${open}${body.replace(/<\/cnsCidadao>/i, `</cnsCidadao>\n<dataNascimento>${epoch}</dataNascimento>`)}${close}`;
      }
      return `${open}${body}\n<dataNascimento>${epoch}</dataNascimento>${close}`;
    },
  );
  return { xml: next, changed };
}

function step(applied: string[], label: string, r: { xml: string; changed: boolean }, current: string) {
  if (!r.changed) return current;
  applied.push(label);
  return r.xml;
}

/**
 * Pipeline FAI: higiene + defaults documentados + applyAutoFixes compartilhado.
 * Não preenche CIAP/CID, conduta, tipo de atendimento, sexo, CNS/CPF, profissional.
 */
export function applyFaiAutoFixes(
  xml: string,
  findings: FaoFinding[],
  opts: AutoFixOptions & { ibgeDefault?: string } = {},
): AutoFixResult {
  const present = new Set(findings.map((f) => f.code));
  const applied: string[] = [];
  const skipped: string[] = [];
  let current = xml;

  current = step(applied, 'XML_ENCODING', fixXmlEncoding(current), current);
  if (present.has('UUID_FICHA_CASE')) {
    current = step(applied, 'UUID_FICHA_CASE', fixUuidFichaCase(current), current);
  }
  if (present.has('CNS_FORMAT') || present.has('CPF_FORMAT')) {
    const r = fixCitizenIdDigits(current);
    if (r.changed) {
      current = r.xml;
      if (present.has('CNS_FORMAT')) applied.push('CNS_FORMAT');
      if (present.has('CPF_FORMAT')) applied.push('CPF_FORMAT');
    }
  }
  if (present.has('CIAP_FORMAT')) {
    current = step(applied, 'CIAP_FORMAT', fixCiapFormat(current), current);
  }
  if (present.has('CID_FORMAT')) {
    current = step(applied, 'CID_FORMAT', fixCidFormat(current), current);
  }
  current = step(applied, 'PROC_CODE_DIGITS', fixProcCodeDigits(current), current);
  current = step(applied, 'ENVELOPE_LOTACAO', copyEnvelopeIneCnesToLotacao(current), current);

  const shared = applyAutoFixes(current, findings, {
    ...opts,
    regenerateUuidFicha: opts.regenerateUuidFicha !== false,
  });
  current = shared.xml;
  applied.push(...shared.applied);
  skipped.push(...shared.skipped);

  if (present.has('UUID_FICHA_LENGTH') && !applied.includes('UUID_FICHA_LENGTH')) {
    current = step(applied, 'UUID_FICHA_LENGTH', fixUuidFichaLength(current), current);
  }

  if (present.has('TURNO')) {
    current = step(applied, 'TURNO', fixTurno(current, FAI_SAFE_DEFAULTS.turno), current);
  }
  if (present.has('LOCAL_ATENDIMENTO')) {
    current = step(
      applied,
      'LOCAL_ATENDIMENTO',
      fixLocalAtendimento(current, FAI_SAFE_DEFAULTS.localAtendimento),
      current,
    );
  }
  if (present.has('IBGE_MISSING') || present.has('IBGE_FORMAT')) {
    const ibge = opts.ibgeDefault || FAI_SAFE_DEFAULTS.ibge;
    current = step(applied, 'IBGE', fixIbge(current, ibge), current);
  }
  if (present.has('TP_CDS_ORIGEM_MISSING') || present.has('TP_CDS_ORIGEM_NOT_3')) {
    if (!applied.includes('TP_CDS_ORIGEM_MISSING') && !applied.includes('TP_CDS_ORIGEM_NOT_3')) {
      current = step(applied, 'TP_CDS_ORIGEM', fixTpCdsOrigem(current, FAI_SAFE_DEFAULTS.tpCdsOrigem), current);
    }
  }
  if (present.has('ST_NAO_POSSUI_CPF') && !applied.includes('ST_NAO_POSSUI_CPF')) {
    current = step(
      applied,
      'ST_NAO_POSSUI_CPF',
      fixStNaoPossuiCpf(current, opts.stNaoPossuiCpfWhenAbsent !== false),
      current,
    );
  }
  if (present.has('CONDUTAS_MAX')) {
    current = step(applied, 'CONDUTAS_MAX', fixCondutasFaiMax(current, 14), current);
  }

  for (const code of FAI_SUGGEST_ONLY_CODES) {
    if (present.has(code)) skipped.push(code);
  }

  return { xml: current, applied, skipped };
}
