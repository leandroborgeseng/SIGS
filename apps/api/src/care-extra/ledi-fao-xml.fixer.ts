/**
 * Correções cirúrgicas em XML LEDI FAO (envelope + master).
 * Preferir patch no XML original para preservar namespaces/remetente.
 */

import type { FaoFinding } from './ledi-fao.validator';

export const AUTO_FIXABLE_CODES = new Set([
  'ST_NAO_POSSUI_CPF',
  'INE_MISSING',
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

/** Injeta stNaoPossuiCpf em cada bloco atendimentosOdontologicos. */
export function fixStNaoPossuiCpf(
  xml: string,
  whenAbsent = true,
): { xml: string; changed: boolean } {
  let changed = false;
  const next = xml.replace(
    /(<atendimentosOdontologicos\b[^>]*>)([\s\S]*?)(<\/atendimentosOdontologicos>)/gi,
    (_m, open: string, body: string, close: string) => {
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
      return `${open}\n<stNaoPossuiCpf>${value}</stNaoPossuiCpf>${body}${close}`;
    },
  );
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
