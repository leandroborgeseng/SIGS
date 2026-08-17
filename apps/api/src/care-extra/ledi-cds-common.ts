/**
 * Críticas LEDI compartilhadas (header / identidade / cruzamento municipal).
 * Usado por RulePacks CDS 2/3/6/8/10 e reforço de PROC — sem inventar BLOCKER clínico.
 */

import { isValidCns, isValidCpf, type FaoFinding, type FaoSeverity } from './ledi-fao.validator';

export type LediMunicipalCrossCtx = {
  /** CNES da rede Prefeitura (natureza 1244 / municipalNetwork). */
  municipalCnes?: ReadonlySet<string>;
  /** CNS de profissionais lotados no PF municipal. */
  municipalCnsProf?: ReadonlySet<string>;
  /** INEs conhecidos por CNES (equipes sync). */
  ineByCnes?: ReadonlyMap<string, ReadonlySet<string>>;
};

export type CdsHeaderSnap = {
  cnes: string;
  cbo: string;
  cnsProf: string;
  ine: string;
  ibge: string;
  dataAtendimento: string;
  uuidFicha: string;
  tpCdsOrigem: string;
};

function push(
  findings: FaoFinding[],
  severity: FaoSeverity,
  code: string,
  message: string,
  extra?: Partial<FaoFinding>,
) {
  findings.push({ severity, code, message, rule: extra?.rule || 'LEDI-CDS', ...extra });
}

export function tagText(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}\\b[^>]*>\\s*([^<]*)`, 'i'));
  return m ? m[1].trim() : '';
}

export function tagDigits(xml: string, tag: string): string {
  return tagText(xml, tag).replace(/\D/g, '');
}

/** Extrai campos de header/lotação/envelope (padrão FAI/FAO/PROC). */
export function extractCdsHeader(xml: string): CdsHeaderSnap {
  const lotacao = xml.match(/<lotacaoFormPrincipal\b[^>]*>([\s\S]*?)<\/lotacaoFormPrincipal>/i)?.[1] || '';
  const header = xml.match(/<headerTransport\b[^>]*>([\s\S]*?)<\/headerTransport>/i)?.[1] || '';
  const scope = `${header}\n${lotacao}\n${xml}`;
  return {
    cnes:
      tagDigits(scope, 'cnes') ||
      tagDigits(xml, 'cnesDadoSerializado') ||
      tagDigits(xml, 'cnesLocalAtividade'),
    cbo: tagDigits(scope, 'cboCodigo_2002') || tagDigits(scope, 'cbo'),
    cnsProf: tagDigits(scope, 'profissionalCNS'),
    ine: tagDigits(scope, 'ine') || tagDigits(xml, 'ineDadoSerializado'),
    ibge: tagDigits(scope, 'codigoIbgeMunicipio') || tagDigits(scope, 'codIbge'),
    dataAtendimento: tagText(scope, 'dataAtendimento'),
    uuidFicha: tagText(xml, 'uuidFicha'),
    tpCdsOrigem: tagText(xml, 'tpCdsOrigem'),
  };
}

/**
 * Header Siaps-oriented (BLOCKER vs MONEY_RISK/QUALITY) alinhado a FAI/FAO/PROC.
 */
export function validateCdsHeader(
  findings: FaoFinding[],
  xml: string,
  opts?: { requireDataAtendimento?: boolean; requireIneBlocker?: boolean },
): CdsHeaderSnap {
  const h = extractCdsHeader(xml);
  const requireData = opts?.requireDataAtendimento !== false;

  if (!h.uuidFicha) {
    push(findings, 'BLOCKER', 'UUID_FICHA_MISSING', 'uuidFicha obrigatório (36–44 chars).', {
      field: 'uuidFicha',
    });
  } else if (h.uuidFicha.length < 36 || h.uuidFicha.length > 44) {
    push(findings, 'MONEY_RISK', 'UUID_FICHA_LENGTH', `uuidFicha com ${h.uuidFicha.length} chars (esperado 36–44).`, {
      field: 'uuidFicha',
    });
  } else if (h.uuidFicha !== h.uuidFicha.toUpperCase()) {
    push(findings, 'QUALITY_WARN', 'UUID_FICHA_CASE', 'uuidFicha deve estar em maiúsculas.', {
      field: 'uuidFicha',
    });
  }

  if (!h.tpCdsOrigem) {
    push(findings, 'BLOCKER', 'TP_CDS_ORIGEM_MISSING', 'tpCdsOrigem obrigatório.', {
      field: 'tpCdsOrigem',
    });
  } else if (Number(h.tpCdsOrigem) !== 3) {
    push(
      findings,
      'MONEY_RISK',
      'TP_CDS_ORIGEM_NOT_3',
      `tpCdsOrigem=${h.tpCdsOrigem}; sistemas terceiros devem usar 3.`,
      { field: 'tpCdsOrigem' },
    );
  }

  if (!h.cnsProf) {
    push(findings, 'BLOCKER', 'PROF_CNS_MISSING', 'CNS do profissional ausente no header/lotação.', {
      field: 'profissionalCNS',
    });
  } else if (!isValidCns(h.cnsProf)) {
    push(findings, 'BLOCKER', 'PROF_CNS_INVALID', `CNS profissional inválido: ${h.cnsProf}.`, {
      field: 'profissionalCNS',
    });
  }

  if (!h.cbo) {
    push(findings, 'BLOCKER', 'CBO_MISSING', 'CBO 2002 ausente na lotação.', {
      field: 'cboCodigo_2002',
    });
  } else if (!/^\d{6}$/.test(h.cbo)) {
    push(findings, 'MONEY_RISK', 'CBO_FORMAT', `CBO "${h.cbo}" deve ter 6 dígitos.`, {
      field: 'cboCodigo_2002',
    });
  }

  if (!h.cnes) {
    push(findings, 'BLOCKER', 'CNES_MISSING', 'CNES da unidade ausente.', { field: 'cnes' });
  } else if (h.cnes.length !== 7) {
    push(findings, 'BLOCKER', 'CNES_FORMAT', `CNES deve ter 7 dígitos (atual: ${h.cnes.length}).`, {
      field: 'cnes',
    });
  }

  if (!h.ibge) {
    push(findings, 'MONEY_RISK', 'IBGE_MISSING', 'código IBGE do município ausente no header.', {
      field: 'codigoIbgeMunicipio',
      hint: 'Cadastre IBGE 7 dígitos (Franca=3516200).',
    });
  } else if (h.ibge.length !== 7) {
    push(findings, 'MONEY_RISK', 'IBGE_FORMAT', `IBGE "${h.ibge}" inválido.`, {
      field: 'codigoIbgeMunicipio',
    });
  }

  if (!h.ine) {
    push(
      findings,
      opts?.requireIneBlocker ? 'BLOCKER' : 'QUALITY_WARN',
      'INE_MISSING',
      'INE da equipe ausente (recomendado em APS / faturamento).',
      { field: 'ine' },
    );
  }

  if (requireData && !h.dataAtendimento) {
    push(findings, 'BLOCKER', 'DATA_ATENDIMENTO_MISSING', 'dataAtendimento obrigatória no header.', {
      field: 'dataAtendimento',
    });
  }

  return h;
}

/** Identidade cidadão: stNaoPossuiCpf + CNS/CPF (padrão FAI/PROC). */
export function validateCitizenIdentityBlock(
  findings: FaoFinding[],
  body: string,
  fieldPrefix = '',
) {
  const prefix = fieldPrefix ? `${fieldPrefix}.` : '';
  if (!/<stNaoPossuiCpf\b/i.test(body) && !/<stCidadaoNaoPossuiCpf\b/i.test(body)) {
    push(findings, 'BLOCKER', 'ST_NAO_POSSUI_CPF', 'Campo stNaoPossuiCpf ausente.', {
      field: `${prefix}stNaoPossuiCpf`,
      hint: 'Inserir false quando há CNS/CPF.',
    });
  }

  const cpf = body.match(/<cpfCidadao>\s*([^<]+)/i)?.[1]?.replace(/\D/g, '') || '';
  const cns = body.match(/<cnsCidadao>\s*([^<]+)/i)?.[1]?.replace(/\D/g, '') || '';
  const stTrue =
    /<stNaoPossuiCpf>\s*true\s*<\/stNaoPossuiCpf>/i.test(body) ||
    /<stCidadaoNaoPossuiCpf>\s*true\s*<\/stCidadaoNaoPossuiCpf>/i.test(body);

  if (cpf && cns) {
    push(findings, 'BLOCKER', 'CPF_CNS_BOTH', 'Não pode informar CPF e CNS juntos.', {
      field: `${prefix}cpfCidadao/cnsCidadao`,
    });
  }
  if (!cpf && !cns && !stTrue) {
    push(findings, 'BLOCKER', 'PATIENT_ID_MISSING', 'Sem CPF nem CNS do cidadão.', {
      field: `${prefix}cnsCidadao`,
    });
  }
  if (cns && !isValidCns(cns)) {
    push(findings, 'BLOCKER', 'CNS_INVALID', 'CNS do cidadão inválido.', {
      field: `${prefix}cnsCidadao`,
    });
  } else if (cns && /[^\d]/.test(body.match(/<cnsCidadao>\s*([^<]+)/i)?.[1] || '')) {
    push(findings, 'QUALITY_WARN', 'CNS_FORMAT', 'CNS com pontuação/espaço — normalizar dígitos.', {
      field: `${prefix}cnsCidadao`,
    });
  }
  if (cpf && !isValidCpf(cpf)) {
    push(findings, 'BLOCKER', 'CPF_INVALID', 'CPF do cidadão inválido.', {
      field: `${prefix}cpfCidadao`,
    });
  }

  if (stTrue && !/<justificativaNaoPossuiCpf\b/i.test(body)) {
    push(
      findings,
      'BLOCKER',
      'JUSTIFICATIVA_CPF_MISSING',
      'stNaoPossuiCpf=true exige justificativaNaoPossuiCpf.',
      { field: `${prefix}justificativaNaoPossuiCpf` },
    );
  }
}

/**
 * Cruzamentos com cadastro mestre municipal (CNES · PF · INE).
 * Só emite findings quando o contexto foi fornecido (rede sync).
 */
export function appendMunicipalCrossChecks(
  findings: FaoFinding[],
  header: CdsHeaderSnap,
  ctx?: LediMunicipalCrossCtx | null,
) {
  if (!ctx) return;

  if (header.cnes && ctx.municipalCnes && ctx.municipalCnes.size > 0) {
    if (!ctx.municipalCnes.has(header.cnes)) {
      push(
        findings,
        'MONEY_RISK',
        'CNES_NOT_IN_MUNICIPAL_NETWORK',
        `CNES ${header.cnes} fora da rede Prefeitura (cadastro mestre municipal).`,
        {
          field: 'cnes',
          hint: 'Confira /unidades (gestão municipal) ou /cadastros/cnes-auditoria.',
          rule: 'CNES-municipal',
        },
      );
    }
  }

  if (header.cnsProf && ctx.municipalCnsProf && ctx.municipalCnsProf.size > 0) {
    if (!ctx.municipalCnsProf.has(header.cnsProf)) {
      push(
        findings,
        'MONEY_RISK',
        'CNS_NOT_IN_MUNICIPAL_CNES',
        `CNS profissional ${header.cnsProf} não está no PF municipal lotado.`,
        {
          field: 'profissionalCNS',
          hint: 'Importe profissionais lotados (CNES/PF) e confira lotação CNS×CBO×CNES×INE.',
          rule: 'CNES-PF',
        },
      );
    }
  }

  if (header.cnes && header.ine && ctx.ineByCnes) {
    const ines = ctx.ineByCnes.get(header.cnes);
    if (ines && ines.size > 0 && !ines.has(header.ine)) {
      push(
        findings,
        'QUALITY_WARN',
        'INE_NOT_IN_CNES_TEAM',
        `INE ${header.ine} não consta nas equipes do CNES ${header.cnes}.`,
        {
          field: 'ine',
          hint: 'Confira /equipes para o estabelecimento.',
          rule: 'CNES-equipe',
        },
      );
    }
  }
}

export function countBySeverity(findings: FaoFinding[]) {
  const blockers = findings.filter((f) => f.severity === 'BLOCKER').length;
  const moneyRisks = findings.filter((f) => f.severity === 'MONEY_RISK').length;
  const qualityWarns = findings.filter((f) => f.severity === 'QUALITY_WARN').length;
  const infos = findings.filter((f) => f.severity === 'INFO').length;
  return { blockers, moneyRisks, qualityWarns, infos };
}

export function eachXmlBlocks(xml: string, tag: string): string[] {
  const blocks: string[] = [];
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) blocks.push(m[1]);
  return blocks;
}
