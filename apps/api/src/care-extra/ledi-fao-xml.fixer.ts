/**
 * Correções cirúrgicas em XML LEDI FAO (envelope + master).
 * Preferir patch no XML original para preservar namespaces/remetente.
 */

import { randomUUID } from 'crypto';
import type { FaoFinding } from './ledi-fao.validator';

export const AUTO_FIXABLE_CODES = new Set([
  'ST_NAO_POSSUI_CPF',
  'JUSTIFICATIVA_CPF_MISSING',
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
  // P2 — zero-input
  'TP_CDS_ORIGEM_MISSING',
  'TP_CDS_ORIGEM_NOT_3',
  'PROC_QTD',
  'CONDUTAS_MAX',
  'VIGILANCIA_MAX',
  'TIPO_CONSULTA_MULTI',
  'UUID_FICHA_LENGTH',
  'UUID_FICHA_CASE',
  'XML_ENCODING',
  'CNS_FORMAT',
  'CPF_FORMAT',
  'CIAP_FORMAT',
  'CID_FORMAT',
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
  /**
   * JUSTIFICATIVA_CPF_UNEXPECTED: remover tag ou forçar st=true.
   * Sem valor → não aplica (semi).
   */
  justificativaCpfUnexpected?: 'remove' | 'force_st';
  /** Regenerar uuidFicha quando UUID_FICHA_LENGTH (default true em auto). */
  regenerateUuidFicha?: boolean;
};

export type AutoFixResult = {
  xml: string;
  applied: string[];
  skipped: string[];
};

function hasCitizenId(body: string): boolean {
  return /<cpfCidadao>\s*\d/i.test(body) || /<cnsCidadao>\s*\d/i.test(body);
}

/** Injeta stNaoPossuiCpf em blocos de atendimento FAO / FAI / PROC / CDS. */
const ST_CPF_BLOCKS = [
  'atendimentosOdontologicos',
  'atendimentosIndividuais',
  'atendProcedimentos',
  'atendimentosDomiciliares',
  'visitasDomiciliares',
  'visitasDomiliciares',
  'fichaVisitaDomiciliarChild',
  'cadastroIndividualTransport',
  'fichaCadastroIndividualChild',
  'cadastroIndividualChild',
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

/** Substitui/insere tag simples nos blocos de atendimento (FAO/FAI/PROC). */
export function fixAtendimentoField(
  xml: string,
  tag: string,
  value: string,
): { xml: string; changed: boolean } {
  const safeTag = tag.replace(/[^\w]/g, '');
  if (!safeTag) return { xml, changed: false };
  let changed = false;
  let next = xml;
  for (const block of ST_CPF_BLOCKS) {
    const reBlock = new RegExp(`(<${block}\\b[^>]*>)([\\s\\S]*?)(<\\/${block}>)`, 'gi');
    next = next.replace(reBlock, (_m, open: string, body: string, close: string) => {
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
      if (/<\/sexo>/i.test(body)) {
        return `${open}${body.replace(
          /<\/sexo>/i,
          `</sexo>\n<${safeTag}>${escapeXml(value)}</${safeTag}>`,
        )}${close}`;
      }
      return `${open}${body}\n<${safeTag}>${escapeXml(value)}</${safeTag}>${close}`;
    });
  }
  return { xml: next, changed };
}

/** Remove tag do atendimento (ex.: CPF ou CNS quando os dois estão presentes). */
export function removeAtendimentoField(xml: string, tag: string): { xml: string; changed: boolean } {
  const safeTag = tag.replace(/[^\w]/g, '');
  if (!safeTag) return { xml, changed: false };
  let changed = false;
  let next = xml;
  for (const block of ST_CPF_BLOCKS) {
    const reBlock = new RegExp(`(<${block}\\b[^>]*>)([\\s\\S]*?)(<\\/${block}>)`, 'gi');
    next = next.replace(reBlock, (_m, open: string, body: string, close: string) => {
      const re = new RegExp(`<${safeTag}\\b[^>]*>[\\s\\S]*?<\\/${safeTag}>\\s*`, 'gi');
      if (!re.test(body)) return `${open}${body}${close}`;
      changed = true;
      return `${open}${body.replace(re, '')}${close}`;
    });
  }
  return { xml: next, changed };
}

export function fixCpfCidadao(xml: string, cpf: string): { xml: string; changed: boolean } {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return { xml, changed: false };
  return fixAtendimentoField(xml, 'cpfCidadao', clean);
}

export function fixCnsCidadao(xml: string, cns: string): { xml: string; changed: boolean } {
  const clean = cns.replace(/\D/g, '');
  if (clean.length < 15 || clean.length > 16) return { xml, changed: false };
  return fixAtendimentoField(xml, 'cnsCidadao', clean);
}

/** Mantém só CPF ou só CNS (resolve CPF_CNS_BOTH). */
export function fixKeepCitizenId(
  xml: string,
  keep: 'cpf' | 'cns',
): { xml: string; changed: boolean } {
  return removeAtendimentoField(xml, keep === 'cpf' ? 'cnsCidadao' : 'cpfCidadao');
}

/** dtNascimento: aceita YYYY-MM-DD ou epoch ms. */
export function fixDtNascimento(xml: string, value: string): { xml: string; changed: boolean } {
  const raw = value.trim();
  let epoch: string | null = null;
  if (/^\d{13}$/.test(raw)) epoch = raw;
  else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const t = Date.parse(`${raw}T12:00:00.000Z`);
    if (Number.isFinite(t)) epoch = String(t);
  }
  if (!epoch) return { xml, changed: false };
  if (/<dataNascimento\b/i.test(xml)) return fixAtendimentoField(xml, 'dataNascimento', epoch);
  return fixAtendimentoField(xml, 'dtNascimento', epoch);
}

export function fixSexo(xml: string, sexo: 0 | 1 | string): { xml: string; changed: boolean } {
  const s = String(sexo);
  if (s !== '0' && s !== '1') return { xml, changed: false };
  return fixAtendimentoField(xml, 'sexo', s);
}

export function fixProfissionalCns(xml: string, cns: string): { xml: string; changed: boolean } {
  const clean = cns.replace(/\D/g, '');
  if (clean.length < 15 || clean.length > 16) return { xml, changed: false };
  let changed = false;
  let next = xml;
  if (/<profissionalCNS\b/i.test(next)) {
    next = next.replace(
      /<profissionalCNS\b[^>]*>[\s\S]*?<\/profissionalCNS>/i,
      `<profissionalCNS>${clean}</profissionalCNS>`,
    );
    changed = true;
  } else if (/<lotacaoFormPrincipal\b/i.test(next)) {
    next = next.replace(
      /(<lotacaoFormPrincipal\b[^>]*>)/i,
      `$1\n<profissionalCNS>${clean}</profissionalCNS>`,
    );
    changed = true;
  }
  return { xml: next, changed };
}

/** dataAtendimento no header (epoch ms ou YYYY-MM-DD). */
export function fixDataAtendimento(xml: string, value: string): { xml: string; changed: boolean } {
  const raw = value.trim();
  let epoch: string | null = null;
  if (/^\d{13}$/.test(raw)) epoch = raw;
  else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const t = Date.parse(`${raw}T12:00:00.000Z`);
    if (Number.isFinite(t)) epoch = String(t);
  }
  if (!epoch) return { xml, changed: false };
  let changed = false;
  let next = xml;
  if (/<dataAtendimento\b/i.test(next)) {
    next = next.replace(
      /<dataAtendimento\b[^>]*>[\s\S]*?<\/dataAtendimento>/i,
      `<dataAtendimento>${epoch}</dataAtendimento>`,
    );
    changed = true;
  } else if (/<headerTransport\b/i.test(next)) {
    next = next.replace(
      /(<\/lotacaoFormPrincipal>)/i,
      `$1\n<dataAtendimento>${epoch}</dataAtendimento>`,
    );
    changed = /<dataAtendimento>/.test(next);
  }
  return { xml: next, changed };
}

export function fixDataHoraAtendimento(
  xml: string,
  which: 'inicial' | 'final',
  value: string,
): { xml: string; changed: boolean } {
  const tag = which === 'inicial' ? 'dataHoraInicialAtendimento' : 'dataHoraFinalAtendimento';
  const raw = value.trim();
  let epoch: string | null = null;
  if (/^\d{13}$/.test(raw)) epoch = raw;
  else {
    const t = Date.parse(raw);
    if (Number.isFinite(t)) epoch = String(t);
  }
  if (!epoch) return { xml, changed: false };
  return fixAtendimentoField(xml, tag, epoch);
}

/** Substitui a lista de condutas (tiposEncamOdonto). */
export function fixTiposEncamOdonto(
  xml: string,
  codes: number[],
): { xml: string; changed: boolean } {
  if (!codes.length) return { xml, changed: false };
  const tags = codes.map((c) => `<tiposEncamOdonto>${c}</tiposEncamOdonto>`).join('\n');
  let changed = false;
  const next = xml.replace(
    /(<atendimentosOdontologicos\b[^>]*>)([\s\S]*?)(<\/atendimentosOdontologicos>)/i,
    (_m, open: string, body: string, close: string) => {
      changed = true;
      const without = body.replace(/<tiposEncamOdonto\b[^>]*>[\s\S]*?<\/tiposEncamOdonto>\s*/gi, '');
      if (/<\/tipoAtendimento>/i.test(without)) {
        return `${open}${without.replace(/<\/tipoAtendimento>/i, `</tipoAtendimento>\n${tags}`)}${close}`;
      }
      return `${open}${without}\n${tags}${close}`;
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

/** Motivo oficial de não possuir CPF (JustificativaNaoPossuiCpfDbEnum). */
export function fixJustificativaNaoPossuiCpf(
  xml: string,
  code: number,
): { xml: string; changed: boolean } {
  const n = Number(code);
  const allowed = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 99]);
  if (!allowed.has(n)) return { xml, changed: false };

  let changed = false;
  let next = xml;

  for (const tag of ST_CPF_BLOCKS) {
    const re = new RegExp(`(<${tag}\\b[^>]*>)([\\s\\S]*?)(<\\/${tag}>)`, 'gi');
    next = next.replace(re, (_m, open: string, body: string, close: string) => {
      let bodyNext = body;
      // Garante stNaoPossuiCpf=true quando há justificativa
      if (/<stNaoPossuiCpf\b/i.test(bodyNext)) {
        bodyNext = bodyNext.replace(
          /<stNaoPossuiCpf\b[^>]*>[\s\S]*?<\/stNaoPossuiCpf>/i,
          '<stNaoPossuiCpf>true</stNaoPossuiCpf>',
        );
      } else if (/<\/gestante>/i.test(bodyNext)) {
        bodyNext = bodyNext.replace(
          /<\/gestante>/i,
          '</gestante>\n<stNaoPossuiCpf>true</stNaoPossuiCpf>',
        );
      } else if (/<\/tipoAtendimento>/i.test(bodyNext)) {
        bodyNext = bodyNext.replace(
          /<\/tipoAtendimento>/i,
          '</tipoAtendimento>\n<stNaoPossuiCpf>true</stNaoPossuiCpf>',
        );
      } else {
        bodyNext = `<stNaoPossuiCpf>true</stNaoPossuiCpf>\n${bodyNext}`;
      }

      const reJ = /<justificativaNaoPossuiCpf\b[^>]*>[\s\S]*?<\/justificativaNaoPossuiCpf>/i;
      if (reJ.test(bodyNext)) {
        changed = true;
        bodyNext = bodyNext.replace(
          reJ,
          `<justificativaNaoPossuiCpf>${n}</justificativaNaoPossuiCpf>`,
        );
      } else if (/<\/stNaoPossuiCpf>/i.test(bodyNext)) {
        changed = true;
        bodyNext = bodyNext.replace(
          /<\/stNaoPossuiCpf>/i,
          `</stNaoPossuiCpf>\n<justificativaNaoPossuiCpf>${n}</justificativaNaoPossuiCpf>`,
        );
      } else {
        changed = true;
        bodyNext = `${bodyNext}\n<justificativaNaoPossuiCpf>${n}</justificativaNaoPossuiCpf>`;
      }
      return `${open}${bodyNext}${close}`;
    });
  }

  return { xml: next, changed };
}

export function fixLocalAtendimento(xml: string, local: number): { xml: string; changed: boolean } {
  const n = Number(local);
  if (!Number.isFinite(n) || n < 1 || n > 10) return { xml, changed: false };
  const value = String(n);
  const hasDe = /<localDeAtendimento\b/i.test(xml);
  const hasPlain = /<localAtendimento\b/i.test(xml);
  if (hasDe || hasPlain) {
    let changed = false;
    let next = xml;
    if (hasDe) {
      const r = fixAtendimentoField(next, 'localDeAtendimento', value);
      next = r.xml;
      changed = changed || r.changed;
    }
    if (hasPlain) {
      const r = fixAtendimentoField(next, 'localAtendimento', value);
      next = r.xml;
      changed = changed || r.changed;
    }
    return { xml: next, changed };
  }
  if (/<atendimentosIndividuais\b/i.test(xml)) {
    return fixAtendimentoField(xml, 'localDeAtendimento', value);
  }
  return fixAtendimentoField(xml, 'localAtendimento', value);
}

/** Origem do sistema (LEDI PEC / terceiros) = 3. */
export function fixTpCdsOrigem(xml: string, value = 3): { xml: string; changed: boolean } {
  const v = String(value);
  let changed = false;
  let next = xml;
  if (/<tpCdsOrigem\b/i.test(next)) {
    next = next.replace(/<tpCdsOrigem\b[^>]*>[\s\S]*?<\/tpCdsOrigem>/i, () => {
      changed = true;
      return `<tpCdsOrigem>${v}</tpCdsOrigem>`;
    });
  } else if (/<uuidFicha\b/i.test(next)) {
    next = next.replace(/(<\/uuidFicha>)/i, `$1\n<tpCdsOrigem>${v}</tpCdsOrigem>`);
    changed = /<tpCdsOrigem>/.test(next);
  }
  return { xml: next, changed };
}

/** Quantidades de procedimento < 1 → mínimo 1. */
export function fixProcQuantidadeMin(xml: string, min = 1): { xml: string; changed: boolean } {
  let changed = false;
  const next = xml.replace(
    /<quantidade\b[^>]*>\s*([^<]*?)\s*<\/quantidade>/gi,
    (full, raw: string) => {
      const n = Number(String(raw).trim());
      if (Number.isFinite(n) && Number.isInteger(n) && n >= min) return full;
      changed = true;
      return `<quantidade>${min}</quantidade>`;
    },
  );
  return { xml: next, changed };
}

/** Mantém só os primeiros N tags repetidos dentro de atendimentosOdontologicos. */
export function keepFirstRepeatedTags(
  xml: string,
  tag: string,
  max: number,
): { xml: string; changed: boolean } {
  let changed = false;
  const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>\\s*`, 'gi');
  const next = xml.replace(
    /(<atendimentosOdontologicos\b[^>]*>)([\s\S]*?)(<\/atendimentosOdontologicos>)/gi,
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

export function fixCondutasMax(xml: string, max = 17): { xml: string; changed: boolean } {
  return keepFirstRepeatedTags(xml, 'tiposEncamOdonto', max);
}

export function fixVigilanciaMax(xml: string, max = 7): { xml: string; changed: boolean } {
  return keepFirstRepeatedTags(xml, 'tiposVigilanciaSaudeBucal', max);
}

export function fixTipoConsultaMulti(xml: string): { xml: string; changed: boolean } {
  return keepFirstRepeatedTags(xml, 'tiposConsultaOdonto', 1);
}

/**
 * Ficha Procedimentos (tipo 7): substitui tags &lt;procedimentos&gt;SIGTAP&lt;/procedimentos&gt;
 * no primeiro bloco atendProcedimentos.
 */
export function fixProcFichaProcedimentos(
  xml: string,
  codes: string[],
): { xml: string; changed: boolean } {
  const cleaned = codes
    .map((c) => c.replace(/\D/g, ''))
    .filter((c) => c.length === 10);
  if (!cleaned.length) return { xml, changed: false };
  const tags = cleaned.map((c) => `<procedimentos>${c}</procedimentos>`).join('\n');
  let changed = false;
  const next = xml.replace(
    /(<atendProcedimentos\b[^>]*>)([\s\S]*?)(<\/atendProcedimentos>)/i,
    (_m, open: string, body: string, close: string) => {
      changed = true;
      const without = body.replace(/<procedimentos\b[^>]*>[\s\S]*?<\/procedimentos>\s*/gi, '');
      if (/<\/turno>/i.test(without)) {
        return `${open}${without.replace(/<\/turno>/i, `</turno>\n${tags}`)}${close}`;
      }
      return `${open}${without}\n${tags}${close}`;
    },
  );
  return { xml: next, changed };
}

/** Remove justificativaNaoPossuiCpf dos blocos de atendimento. */
export function fixRemoveJustificativaNaoPossuiCpf(xml: string): { xml: string; changed: boolean } {
  let changed = false;
  let next = xml;
  for (const tag of ST_CPF_BLOCKS) {
    const re = new RegExp(`(<${tag}\\b[^>]*>)([\\s\\S]*?)(<\\/${tag}>)`, 'gi');
    next = next.replace(re, (_m, open: string, body: string, close: string) => {
      if (!/<justificativaNaoPossuiCpf\b/i.test(body)) return `${open}${body}${close}`;
      changed = true;
      const bodyNext = body.replace(
        /<justificativaNaoPossuiCpf\b[^>]*>[\s\S]*?<\/justificativaNaoPossuiCpf>\s*/gi,
        '',
      );
      return `${open}${bodyNext}${close}`;
    });
  }
  return { xml: next, changed };
}

/** Força stNaoPossuiCpf=true (mantém justificativa se já existir). */
export function fixForceStNaoPossuiCpfTrue(xml: string): { xml: string; changed: boolean } {
  let changed = false;
  let next = xml;
  for (const tag of ST_CPF_BLOCKS) {
    const re = new RegExp(`(<${tag}\\b[^>]*>)([\\s\\S]*?)(<\\/${tag}>)`, 'gi');
    next = next.replace(re, (_m, open: string, body: string, close: string) => {
      if (/<stNaoPossuiCpf\b/i.test(body)) {
        const bodyNext = body.replace(
          /<stNaoPossuiCpf\b[^>]*>[\s\S]*?<\/stNaoPossuiCpf>/i,
          '<stNaoPossuiCpf>true</stNaoPossuiCpf>',
        );
        if (bodyNext !== body) changed = true;
        return `${open}${bodyNext}${close}`;
      }
      changed = true;
      if (/<\/gestante>/i.test(body)) {
        return `${open}${body.replace(/<\/gestante>/i, '</gestante>\n<stNaoPossuiCpf>true</stNaoPossuiCpf>')}${close}`;
      }
      return `${open}\n<stNaoPossuiCpf>true</stNaoPossuiCpf>${body}${close}`;
    });
  }
  return { xml: next, changed };
}

/**
 * Regenera uuidFicha no formato canônico CNES-UUID (44) ou UUID (36).
 * Também alinha uuidDadoSerializado quando igual ao antigo.
 */
export function fixUuidFichaLength(xml: string): { xml: string; changed: boolean } {
  const m = xml.match(/<uuidFicha\b[^>]*>\s*([^<]*?)\s*<\/uuidFicha>/i);
  if (!m) return { xml, changed: false };
  const cur = m[1].trim();
  if (cur.length >= 36 && cur.length <= 44) return { xml, changed: false };

  const cnes =
    xml.match(/<cnesDadoSerializado>\s*(\d{7})\s*<\/cnesDadoSerializado>/i)?.[1] ||
    xml.match(/<cnes>\s*(\d{7})\s*<\/cnes>/i)?.[1];
  const uuid = randomUUID().toUpperCase();
  const nextId = cnes ? `${cnes}-${uuid}` : uuid;

  let next = xml.replace(
    /<uuidFicha\b[^>]*>[\s\S]*?<\/uuidFicha>/i,
    `<uuidFicha>${nextId}</uuidFicha>`,
  );
  if (cur && new RegExp(`<uuidDadoSerializado>\\s*${escapeRegex(cur)}\\s*<\\/uuidDadoSerializado>`, 'i').test(next)) {
    next = next.replace(
      /<uuidDadoSerializado\b[^>]*>[\s\S]*?<\/uuidDadoSerializado>/i,
      `<uuidDadoSerializado>${nextId}</uuidDadoSerializado>`,
    );
  }
  return { xml: next, changed: true };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

/** Códigos seguros compartilhados FAI + CDS 2/3/6/7/8/10 (sem clínica FAO). */
export const CDS_SAFE_AUTO_FIXABLE_CODES = new Set([
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

export function classifyAutoFixable(
  findings: FaoFinding[],
  tipo?: string,
): string[] {
  const codes = new Set<string>();
  const allow =
    tipo === 'FAO' || !tipo
      ? AUTO_FIXABLE_CODES
      : tipo === 'FAI' ||
          tipo === 'PROCEDIMENTOS' ||
          tipo === 'CADASTRO_INDIVIDUAL' ||
          tipo === 'CADASTRO_DOMICILIAR' ||
          tipo === 'COLETIVO' ||
          tipo === 'VISITA_ACS' ||
          tipo === 'AD'
        ? CDS_SAFE_AUTO_FIXABLE_CODES
        : AUTO_FIXABLE_CODES;
  for (const f of findings) {
    if (allow.has(f.code)) codes.add(f.code);
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

  // P2 — zero-input
  if (present.has('TP_CDS_ORIGEM_MISSING') || present.has('TP_CDS_ORIGEM_NOT_3')) {
    const r = fixTpCdsOrigem(current, 3);
    current = r.xml;
    if (r.changed) {
      if (present.has('TP_CDS_ORIGEM_MISSING')) applied.push('TP_CDS_ORIGEM_MISSING');
      if (present.has('TP_CDS_ORIGEM_NOT_3')) applied.push('TP_CDS_ORIGEM_NOT_3');
    } else {
      if (present.has('TP_CDS_ORIGEM_MISSING')) skipped.push('TP_CDS_ORIGEM_MISSING');
      if (present.has('TP_CDS_ORIGEM_NOT_3')) skipped.push('TP_CDS_ORIGEM_NOT_3');
    }
  }

  if (present.has('PROC_QTD')) {
    const r = fixProcQuantidadeMin(current, 1);
    current = r.xml;
    if (r.changed) applied.push('PROC_QTD');
    else skipped.push('PROC_QTD');
  }

  if (present.has('CONDUTAS_MAX')) {
    const r = fixCondutasMax(current, 17);
    current = r.xml;
    if (r.changed) applied.push('CONDUTAS_MAX');
    else skipped.push('CONDUTAS_MAX');
  }

  if (present.has('VIGILANCIA_MAX')) {
    const r = fixVigilanciaMax(current, 7);
    current = r.xml;
    if (r.changed) applied.push('VIGILANCIA_MAX');
    else skipped.push('VIGILANCIA_MAX');
  }

  if (present.has('TIPO_CONSULTA_MULTI')) {
    const r = fixTipoConsultaMulti(current);
    current = r.xml;
    if (r.changed) applied.push('TIPO_CONSULTA_MULTI');
    else skipped.push('TIPO_CONSULTA_MULTI');
  }

  if (present.has('UUID_FICHA_LENGTH')) {
    if (opts.regenerateUuidFicha !== false) {
      const r = fixUuidFichaLength(current);
      current = r.xml;
      if (r.changed) applied.push('UUID_FICHA_LENGTH');
      else skipped.push('UUID_FICHA_LENGTH');
    } else {
      skipped.push('UUID_FICHA_LENGTH');
    }
  }

  if (present.has('JUSTIFICATIVA_CPF_UNEXPECTED')) {
    if (opts.justificativaCpfUnexpected === 'remove') {
      const r = fixRemoveJustificativaNaoPossuiCpf(current);
      current = r.xml;
      if (r.changed) applied.push('JUSTIFICATIVA_CPF_UNEXPECTED');
      else skipped.push('JUSTIFICATIVA_CPF_UNEXPECTED');
    } else if (opts.justificativaCpfUnexpected === 'force_st') {
      const r = fixForceStNaoPossuiCpfTrue(current);
      current = r.xml;
      if (r.changed) applied.push('JUSTIFICATIVA_CPF_UNEXPECTED');
      else skipped.push('JUSTIFICATIVA_CPF_UNEXPECTED');
    } else {
      skipped.push('JUSTIFICATIVA_CPF_UNEXPECTED');
    }
  }

  return { xml: current, applied, skipped };
}
