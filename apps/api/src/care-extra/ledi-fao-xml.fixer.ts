/**
 * Correções cirúrgicas em XML LEDI FAO (envelope + master).
 * Preferir patch no XML original para preservar namespaces/remetente.
 */

import type { FaoFinding } from './ledi-fao.validator';

export const AUTO_FIXABLE_CODES = new Set([
  'ST_NAO_POSSUI_CPF',
  'INE_MISSING',
  'PREVINE_INE_MISSING',
  'PROBLEMAS_MISSING',
  'PROBLEMA_SEM_CODIGO',
  'PREVINE_PROBLEMAS_MISSING',
  'VIGILANCIA_MISSING',
  'TIPO_CONSULTA_REQUIRED',
  'TRATAMENTO_CONCLUIDO_RULE',
  'GESTANTE_MISSING',
  'TURNO',
  'LOCAL_ATENDIMENTO',
  'CBO_MISSING',
  'CBO_NOT_ODONTO',
  'PREVINE_CBO_NOT_ESB',
  'PREVINE_VIGILANCIA_99',
  'CNES_MISSING',
  'CNES_FORMAT',
  'IBGE_MISSING',
  'IBGE_FORMAT',
  'PREVINE_B1_NO_FIRST_CONSULTA',
  'PREVINE_B2_NO_CONCLUSAO',
  'PREVINE_B5_NO_PREVENTIVE',
  'PREVINE_B5_LOW_PREVENTIVE',
  'PREVINE_B6_NO_ART',
]);

export type AutoFixOptions = {
  /** Aplicar stNaoPossuiCpf. Default true. */
  stNaoPossuiCpf?: boolean;
  /**
   * Valor quando cidadão não tem CPF/CNS no XML.
   * Com CPF ou CNS → sempre false.
   */
  stNaoPossuiCpfWhenAbsent?: boolean;
  /** Preencher INE ausente (envelope + lotação). */
  ine?: string;
};

export type AutoFixResult = {
  xml: string;
  applied: string[];
  skipped: string[];
};

function hasCitizenId(body: string): boolean {
  return /<cpfCidadao>\s*\d/i.test(body) || /<cnsCidadao>\s*\d/i.test(body);
}

/** Injeta stNaoPossuiCpf em blocos de atendimento FAO / FAI / Procedimentos. */
const ST_CPF_BLOCKS = [
  'atendimentosOdontologicos',
  'atendimentosIndividuais',
  'atendProcedimentos',
] as const;

export function fixStNaoPossuiCpf(
  xml: string,
  whenAbsent = true,
): { xml: string; changed: boolean } {
  let changed = false;
  let next = xml;

  for (const tag of ST_CPF_BLOCKS) {
    const re = new RegExp(`(<${tag}\\b[^>]*>)([\\s\\S]*?)(<\\/${tag}>)`, 'gi');
    next = next.replace(re, (_m, open: string, body: string, close: string) => {
      if (/<stNaoPossuiCpf\b/i.test(body)) return `${open}${body}${close}`;
      const value = hasCitizenId(body) ? 'false' : whenAbsent ? 'true' : 'false';
      changed = true;
      if (/<\/gestante>/i.test(body)) {
        return `${open}${body.replace(/<\/gestante>/i, `</gestante>\n<stNaoPossuiCpf>${value}</stNaoPossuiCpf>`)}${close}`;
      }
      if (/<\/tipoAtendimento>/i.test(body)) {
        return `${open}${body.replace(
          /<\/tipoAtendimento>/i,
          `</tipoAtendimento>\n<stNaoPossuiCpf>${value}</stNaoPossuiCpf>`,
        )}${close}`;
      }
      if (/<\/sexo>/i.test(body)) {
        return `${open}${body.replace(/<\/sexo>/i, `</sexo>\n<stNaoPossuiCpf>${value}</stNaoPossuiCpf>`)}${close}`;
      }
      if (/<\/localAtendimento>/i.test(body)) {
        return `${open}${body.replace(
          /<\/localAtendimento>/i,
          `</localAtendimento>\n<stNaoPossuiCpf>${value}</stNaoPossuiCpf>`,
        )}${close}`;
      }
      if (/<\/turno>/i.test(body)) {
        return `${open}${body.replace(/<\/turno>/i, `</turno>\n<stNaoPossuiCpf>${value}</stNaoPossuiCpf>`)}${close}`;
      }
      return `${open}\n<stNaoPossuiCpf>${value}</stNaoPossuiCpf>${body}${close}`;
    });
  }

  return { xml: next, changed };
}

/** Preenche ou cria ineDadoSerializado e ine na lotação. */
export function fixIne(xml: string, ine: string): { xml: string; changed: boolean } {
  const clean = ine.replace(/\D/g, '');
  if (!clean) return { xml, changed: false };
  let next = xml;
  let changed = false;

  if (/<ineDadoSerializado>\s*<\/ineDadoSerializado>/i.test(next) || !/<ineDadoSerializado>/i.test(next)) {
    if (/<ineDadoSerializado>/i.test(next)) {
      next = next.replace(
        /<ineDadoSerializado>\s*[^<]*<\/ineDadoSerializado>/i,
        `<ineDadoSerializado>${clean}</ineDadoSerializado>`,
      );
      changed = true;
    } else if (/<\/cnesDadoSerializado>/i.test(next)) {
      next = next.replace(
        /<\/cnesDadoSerializado>/i,
        `</cnesDadoSerializado>\n<ineDadoSerializado>${clean}</ineDadoSerializado>`,
      );
      changed = true;
    }
  } else if (/<ineDadoSerializado>\s*<\/ineDadoSerializado>/i.test(next)) {
    next = next.replace(
      /<ineDadoSerializado>\s*<\/ineDadoSerializado>/i,
      `<ineDadoSerializado>${clean}</ineDadoSerializado>`,
    );
    changed = true;
  }

  // lotação sem <ine>
  if (/<lotacaoFormPrincipal\b/i.test(next) && !/<lotacaoFormPrincipal[\s\S]*?<ine>/i.test(next)) {
    if (/<lotacaoFormPrincipal\b[^>]*>[\s\S]*?<\/cnes>/i.test(next)) {
      next = next.replace(
        /(<lotacaoFormPrincipal\b[^>]*>[\s\S]*?<\/cnes>)/i,
        `$1\n<ine>${clean}</ine>`,
      );
      changed = true;
    }
  } else if (/<lotacaoFormPrincipal[\s\S]*?<ine>\s*<\/ine>/i.test(next)) {
    next = next.replace(/(<lotacaoFormPrincipal[\s\S]*?<ine>)\s*(<\/ine>)/i, `$1${clean}$2`);
    changed = true;
  }

  return { xml: next, changed };
}

/**
 * Insere/substitui problemasCondicoes no primeiro atendimento.
 * CIAP e/ou CID10 obrigatórios na regra FAO.
 */
export function fixProblemasCondicoes(
  xml: string,
  problemas: Array<{ ciap?: string; cid10?: string }>,
): { xml: string; changed: boolean } {
  const valid = problemas.filter((p) => (p.ciap || p.cid10 || '').trim());
  if (!valid.length) return { xml, changed: false };

  const block = valid
    .map((p) => {
      const parts: string[] = ['<problemasCondicoes>'];
      if (p.ciap?.trim()) parts.push(`<ciap>${escapeXml(p.ciap.trim())}</ciap>`);
      if (p.cid10?.trim()) parts.push(`<cid10>${escapeXml(p.cid10.trim())}</cid10>`);
      parts.push('</problemasCondicoes>');
      return parts.join('');
    })
    .join('\n');

  let changed = false;
  const next = xml.replace(
    /(<atendimentosOdontologicos\b[^>]*>)([\s\S]*?)(<\/atendimentosOdontologicos>)/i,
    (_m, open: string, body: string, close: string) => {
      changed = true;
      const without = body.replace(/<problemasCondicoes\b[\s\S]*?<\/problemasCondicoes>\s*/gi, '');
      if (/<\/turno>/i.test(without)) {
        return `${open}${without.replace(/<\/turno>/i, `</turno>\n${block}`)}${close}`;
      }
      if (/<\/sexo>/i.test(without)) {
        return `${open}${without.replace(/<\/sexo>/i, `</sexo>\n${block}`)}${close}`;
      }
      return `${open}${without}\n${block}${close}`;
    },
  );
  return { xml: next, changed };
}

/** Define tiposConsultaOdonto (substitui existentes no atendimento). */
export function fixTiposConsultaOdonto(xml: string, codes: number[]): { xml: string; changed: boolean } {
  if (!codes.length) return { xml, changed: false };
  const tags = codes.map((c) => `<tiposConsultaOdonto>${c}</tiposConsultaOdonto>`).join('\n');
  let changed = false;
  const next = xml.replace(
    /(<atendimentosOdontologicos\b[^>]*>)([\s\S]*?)(<\/atendimentosOdontologicos>)/i,
    (_m, open: string, body: string, close: string) => {
      changed = true;
      const without = body.replace(/<tiposConsultaOdonto\b[^>]*>[\s\S]*?<\/tiposConsultaOdonto>\s*/gi, '');
      if (/<\/tiposVigilanciaSaudeBucal>/i.test(without)) {
        return `${open}${without.replace(
          /<\/tiposVigilanciaSaudeBucal>/i,
          `</tiposVigilanciaSaudeBucal>\n${tags}`,
        )}${close}`;
      }
      if (/<\/tipoAtendimento>/i.test(without)) {
        return `${open}${without.replace(/<\/tipoAtendimento>/i, `</tipoAtendimento>\n${tags}`)}${close}`;
      }
      return `${open}${without}\n${tags}${close}`;
    },
  );
  return { xml: next, changed };
}

/** Acrescenta tiposEncamOdonto sem remover os existentes (ex.: conduta 15). */
export function addTiposEncamOdonto(xml: string, codes: number[]): { xml: string; changed: boolean } {
  const want = [...new Set(codes.map((c) => Number(c)).filter((n) => Number.isFinite(n)))];
  if (!want.length) return { xml, changed: false };
  let changed = false;
  const next = xml.replace(
    /(<atendimentosOdontologicos\b[^>]*>)([\s\S]*?)(<\/atendimentosOdontologicos>)/i,
    (_m, open: string, body: string, close: string) => {
      const present = new Set(
        [...body.matchAll(/<tiposEncamOdonto>\s*(\d+)\s*<\/tiposEncamOdonto>/gi)].map((x) => Number(x[1])),
      );
      const missing = want.filter((c) => !present.has(c));
      if (!missing.length) return `${open}${body}${close}`;
      changed = true;
      const tags = missing.map((c) => `<tiposEncamOdonto>${c}</tiposEncamOdonto>`).join('\n');
      if (/<\/tiposEncamOdonto>/i.test(body)) {
        return `${open}${body.replace(/(<\/tiposEncamOdonto>)(?![\s\S]*<\/tiposEncamOdonto>)/i, `$1\n${tags}`)}${close}`;
      }
      if (/<\/tipoAtendimento>/i.test(body)) {
        return `${open}${body.replace(/<\/tipoAtendimento>/i, `</tipoAtendimento>\n${tags}`)}${close}`;
      }
      return `${open}${body}\n${tags}${close}`;
    },
  );
  return { xml: next, changed };
}

/** Substitui tiposVigilanciaSaudeBucal no primeiro atendimento. */
export function fixTiposVigilanciaSaudeBucal(
  xml: string,
  codes: number[],
): { xml: string; changed: boolean } {
  if (!codes.length) return { xml, changed: false };
  const tags = codes.map((c) => `<tiposVigilanciaSaudeBucal>${c}</tiposVigilanciaSaudeBucal>`).join('\n');
  let changed = false;
  const next = xml.replace(
    /(<atendimentosOdontologicos\b[^>]*>)([\s\S]*?)(<\/atendimentosOdontologicos>)/i,
    (_m, open: string, body: string, close: string) => {
      changed = true;
      const without = body.replace(
        /<tiposVigilanciaSaudeBucal\b[^>]*>[\s\S]*?<\/tiposVigilanciaSaudeBucal>\s*/gi,
        '',
      );
      if (/<\/tipoAtendimento>/i.test(without)) {
        return `${open}${without.replace(/<\/tipoAtendimento>/i, `</tipoAtendimento>\n${tags}`)}${close}`;
      }
      return `${open}${without}\n${tags}${close}`;
    },
  );
  return { xml: next, changed };
}

/**
 * Acrescenta procedimentos SIGTAP que ainda não existem no atendimento.
 * Não remove procedimentos já enviados.
 */
export function addProcedimentos(
  xml: string,
  procs: Array<{ coMsProcedimento: string; quantidade?: number }>,
): { xml: string; changed: boolean } {
  const valid = procs
    .map((p) => ({
      code: String(p.coMsProcedimento || '').replace(/\D/g, ''),
      qty: Math.max(1, Number(p.quantidade) || 1),
    }))
    .filter((p) => p.code.length >= 8);
  if (!valid.length) return { xml, changed: false };

  let changed = false;
  const next = xml.replace(
    /(<atendimentosOdontologicos\b[^>]*>)([\s\S]*?)(<\/atendimentosOdontologicos>)/i,
    (_m, open: string, body: string, close: string) => {
      const present = new Set(
        [...body.matchAll(/<coMsProcedimento>\s*([^<]+)\s*<\/coMsProcedimento>/gi)].map((x) =>
          String(x[1]).replace(/\D/g, ''),
        ),
      );
      const missing = valid.filter((p) => !present.has(p.code));
      if (!missing.length) return `${open}${body}${close}`;
      changed = true;
      const block = missing
        .map(
          (p) =>
            `<procedimentosRealizados>\n<coMsProcedimento>${p.code}</coMsProcedimento>\n<quantidade>${p.qty}</quantidade>\n</procedimentosRealizados>`,
        )
        .join('\n');
      if (/<\/procedimentosRealizados>/i.test(body)) {
        return `${open}${body.replace(
          /(<\/procedimentosRealizados>)(?![\s\S]*<\/procedimentosRealizados>)/i,
          `$1\n${block}`,
        )}${close}`;
      }
      if (/<\/tiposConsultaOdonto>/i.test(body)) {
        return `${open}${body.replace(/<\/tiposConsultaOdonto>/i, `</tiposConsultaOdonto>\n${block}`)}${close}`;
      }
      return `${open}${body}\n${block}${close}`;
    },
  );
  return { xml: next, changed };
}

/** Atualiza CBO na lotação principal (e header se existir). */
export function fixCbo(xml: string, cbo: string): { xml: string; changed: boolean } {
  const clean = cbo.replace(/\D/g, '');
  if (clean.length < 6) return { xml, changed: false };
  let changed = false;
  let next = xml;
  if (/<cboCodigo_2002>/i.test(next)) {
    next = next.replace(/<cboCodigo_2002>\s*[^<]*<\/cboCodigo_2002>/gi, () => {
      changed = true;
      return `<cboCodigo_2002>${clean}</cboCodigo_2002>`;
    });
  } else if (/<\/profissionalCNS>/i.test(next)) {
    next = next.replace(
      /<\/profissionalCNS>/i,
      `</profissionalCNS>\n<cboCodigo_2002>${clean}</cboCodigo_2002>`,
    );
    changed = true;
  }
  return { xml: next, changed };
}

/** Substitui/insere tag simples no primeiro atendimento. */
export function fixAtendimentoField(
  xml: string,
  tag: string,
  value: string,
): { xml: string; changed: boolean } {
  const safeTag = tag.replace(/[^\w]/g, '');
  if (!safeTag) return { xml, changed: false };
  let changed = false;
  const next = xml.replace(
    /(<atendimentosOdontologicos\b[^>]*>)([\s\S]*?)(<\/atendimentosOdontologicos>)/i,
    (_m, open: string, body: string, close: string) => {
      const re = new RegExp(`<${safeTag}\\b[^>]*>[\\s\\S]*?<\\/${safeTag}>`, 'i');
      if (re.test(body)) {
        changed = true;
        return `${open}${body.replace(re, `<${safeTag}>${escapeXml(value)}</${safeTag}>`)}${close}`;
      }
      changed = true;
      if (/<\/tipoAtendimento>/i.test(body)) {
        return `${open}${body.replace(
          /<\/tipoAtendimento>/i,
          `</tipoAtendimento>\n<${safeTag}>${escapeXml(value)}</${safeTag}>`,
        )}${close}`;
      }
      return `${open}${body}\n<${safeTag}>${escapeXml(value)}</${safeTag}>${close}`;
    },
  );
  return { xml: next, changed };
}

export function fixTurno(xml: string, turno: number): { xml: string; changed: boolean } {
  const t = Number(turno);
  if (![1, 2, 3].includes(t)) return { xml, changed: false };
  return fixAtendimentoField(xml, 'turno', String(t));
}

export function fixGestante(xml: string, gestante: boolean): { xml: string; changed: boolean } {
  return fixAtendimentoField(xml, 'gestante', gestante ? 'true' : 'false');
}

export function fixLocalAtendimento(xml: string, local: number): { xml: string; changed: boolean } {
  const n = Number(local);
  if (!Number.isFinite(n) || n < 1 || n > 10) return { xml, changed: false };
  return fixAtendimentoField(xml, 'localAtendimento', String(n));
}

export function fixCnes(xml: string, cnes: string): { xml: string; changed: boolean } {
  const clean = cnes.replace(/\D/g, '');
  if (clean.length !== 7) return { xml, changed: false };
  let changed = false;
  let next = xml;
  if (/<cnesDadoSerializado>/i.test(next)) {
    next = next.replace(/<cnesDadoSerializado>\s*[^<]*<\/cnesDadoSerializado>/i, () => {
      changed = true;
      return `<cnesDadoSerializado>${clean}</cnesDadoSerializado>`;
    });
  }
  if (/<cnes>/i.test(next)) {
    next = next.replace(/<cnes>\s*[^<]*<\/cnes>/gi, () => {
      changed = true;
      return `<cnes>${clean}</cnes>`;
    });
  }
  return { xml: next, changed };
}

export function fixIbge(xml: string, ibge: string): { xml: string; changed: boolean } {
  const clean = ibge.replace(/\D/g, '');
  if (clean.length !== 7) return { xml, changed: false };
  let changed = false;
  let next = xml;
  if (/<codigoIbgeMunicipio>/i.test(next)) {
    next = next.replace(/<codigoIbgeMunicipio>\s*[^<]*<\/codigoIbgeMunicipio>/gi, () => {
      changed = true;
      return `<codigoIbgeMunicipio>${clean}</codigoIbgeMunicipio>`;
    });
  } else if (/<\/dataAtendimento>/i.test(next)) {
    next = next.replace(
      /<\/dataAtendimento>/i,
      `</dataAtendimento>\n<codigoIbgeMunicipio>${clean}</codigoIbgeMunicipio>`,
    );
    changed = true;
  }
  if (/<codIbge>/i.test(next)) {
    next = next.replace(/<codIbge>\s*[^<]*<\/codIbge>/i, () => {
      changed = true;
      return `<codIbge>${clean}</codIbge>`;
    });
  }
  return { xml: next, changed };
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function classifyAutoFixable(findings: FaoFinding[]): string[] {
  const codes = new Set<string>();
  for (const f of findings) {
    if (AUTO_FIXABLE_CODES.has(f.code)) codes.add(f.code);
  }
  return [...codes];
}

/** Aplica correções automáticas confirmadas pelo usuário. */
export function applyAutoFixes(
  xml: string,
  findings: FaoFinding[],
  opts: AutoFixOptions,
): AutoFixResult {
  const present = new Set(findings.map((f) => f.code));
  const applied: string[] = [];
  const skipped: string[] = [];
  let current = xml;

  if (present.has('ST_NAO_POSSUI_CPF')) {
    if (opts.stNaoPossuiCpf !== false) {
      const r = fixStNaoPossuiCpf(current, opts.stNaoPossuiCpfWhenAbsent !== false);
      current = r.xml;
      if (r.changed) applied.push('ST_NAO_POSSUI_CPF');
      else skipped.push('ST_NAO_POSSUI_CPF');
    } else {
      skipped.push('ST_NAO_POSSUI_CPF');
    }
  }

  if (present.has('INE_MISSING')) {
    if (opts.ine?.trim()) {
      const r = fixIne(current, opts.ine);
      current = r.xml;
      if (r.changed) applied.push('INE_MISSING');
      else skipped.push('INE_MISSING');
    } else {
      skipped.push('INE_MISSING');
    }
  }

  return { xml: current, applied, skipped };
}
