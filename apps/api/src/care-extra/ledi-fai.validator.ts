/**
 * Validador estrutural LEDI — Ficha de Atendimento Individual (tipo 4).
 * Bloqueios prioritários do lote Franca / Novas Fichas Exemplo.
 */

import { isValidCns, isValidCpf, type FaoFinding, type FaoSeverity } from './ledi-fao.validator';
import { detectLediFichaTipo } from './ledi-ficha-tipo';

export type FaiValidationReport = {
  conformant: boolean;
  siapsReady: boolean;
  previneReady: boolean;
  readyForFinalSend: boolean;
  channel: 'LEDI_FAI_SIAPS';
  sourceKind: 'xml' | 'json';
  detectedFormat: string;
  summary: {
    blockers: number;
    moneyRisks: number;
    qualityWarns: number;
    infos: number;
  };
  findings: FaoFinding[];
};

function count(findings: FaoFinding[], sev: FaoSeverity) {
  return findings.filter((f) => f.severity === sev).length;
}

function eachAtendimento(xml: string): string[] {
  const blocks: string[] = [];
  const re = /<atendimentosIndividuais\b[^>]*>([\s\S]*?)<\/atendimentosIndividuais>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) blocks.push(m[1]);
  return blocks;
}

const FAI_TIPO_OK = new Set([1, 2, 4, 5, 6]);
const FAI_CONDUTA_OK = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);

function tagRaw(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}\\b[^>]*>\\s*([^<]*)`, 'i'));
  return m ? m[1] : null;
}

function epochMs(v: string | null | undefined): number | null {
  if (v == null || String(v).trim() === '') return null;
  const s = String(v).trim();
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return n >= 1e11 ? n : n * 1000;
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

function ciapNorm(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

function cidNorm(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function validateFaiXml(xml: string): FaiValidationReport {
  const findings: FaoFinding[] = [];
  const tipo = detectLediFichaTipo(xml);

  if (tipo.id !== 'FAI') {
    findings.push({
      severity: 'BLOCKER',
      code: 'WRONG_FICHA_TIPO',
      message: `Esperado FAI (4); detectado ${tipo.label} (${tipo.code ?? '?'}).`,
      field: 'tipoDadoSerializado',
      rule: 'LEDI-tipo',
      hint: tipo.correctionPath,
    });
  }

  const decl = xml.match(/<\?xml\b[^?]*\?>/i)?.[0] || '';
  if (!decl || !/encoding\s*=\s*["']utf-8["']/i.test(decl)) {
    findings.push({
      severity: 'QUALITY_WARN',
      code: 'XML_ENCODING',
      message: 'Declaração XML ausente ou encoding diferente de utf-8.',
      field: 'xml',
      rule: 'LEDI-FAI',
      hint: 'Normaliza encoding="utf-8".',
    });
  }

  if (!/fichaAtendimentoIndividualMasterTransport/i.test(xml)) {
    findings.push({
      severity: 'BLOCKER',
      code: 'FAI_ROOT_NOT_FOUND',
      message: 'Raiz fichaAtendimentoIndividualMasterTransport não encontrada.',
      field: 'master',
      rule: 'LEDI-FAI',
    });
  }

  const uuidRaw = tagRaw(xml, 'uuidFicha');
  if (uuidRaw == null || !uuidRaw.trim()) {
    findings.push({
      severity: 'BLOCKER',
      code: 'UUID_FICHA_MISSING',
      message: 'uuidFicha obrigatório (36–44 chars).',
      field: 'uuidFicha',
      rule: 'LEDI-FAI',
    });
  } else {
    const uuid = uuidRaw.trim();
    if (uuid.length < 36 || uuid.length > 44) {
      findings.push({
        severity: 'MONEY_RISK',
        code: 'UUID_FICHA_LENGTH',
        message: `uuidFicha com ${uuid.length} chars (esperado 36–44).`,
        field: 'uuidFicha',
        rule: 'LEDI-FAI',
      });
    } else if (uuid !== uuid.toUpperCase()) {
      findings.push({
        severity: 'QUALITY_WARN',
        code: 'UUID_FICHA_CASE',
        message: 'uuidFicha deve estar em maiúsculas.',
        field: 'uuidFicha',
        rule: 'LEDI-FAI',
      });
    }
  }

  const tpRaw = tagRaw(xml, 'tpCdsOrigem');
  if (tpRaw == null || tpRaw.trim() === '') {
    findings.push({
      severity: 'BLOCKER',
      code: 'TP_CDS_ORIGEM_MISSING',
      message: 'tpCdsOrigem obrigatório.',
      field: 'tpCdsOrigem',
      rule: 'LEDI-FAI',
    });
  } else if (Number(tpRaw.trim()) !== 3) {
    findings.push({
      severity: 'MONEY_RISK',
      code: 'TP_CDS_ORIGEM_NOT_3',
      message: `tpCdsOrigem=${tpRaw.trim()}; sistemas terceiros devem usar 3.`,
      field: 'tpCdsOrigem',
      rule: 'LEDI-FAI',
    });
  }

  const dataAtRaw = tagRaw(xml, 'dataAtendimento');
  if (dataAtRaw == null || dataAtRaw.trim() === '') {
    findings.push({
      severity: 'BLOCKER',
      code: 'DATA_ATENDIMENTO_MISSING',
      message: 'dataAtendimento obrigatória no header.',
      field: 'dataAtendimento',
      rule: 'LEDI-FAI',
    });
  }

  const ibgeRaw = tagRaw(xml, 'codigoIbgeMunicipio') ?? tagRaw(xml, 'codIbge');
  const ibgeDigits = (ibgeRaw || '').replace(/\D/g, '');
  if (!ibgeDigits) {
    findings.push({
      severity: 'MONEY_RISK',
      code: 'IBGE_MISSING',
      message: 'código IBGE do município ausente no header.',
      field: 'codigoIbgeMunicipio',
      rule: 'LEDI-FAI',
    });
  } else if (ibgeDigits.length !== 7) {
    findings.push({
      severity: 'MONEY_RISK',
      code: 'IBGE_FORMAT',
      message: `IBGE "${(ibgeRaw || '').trim()}" inválido.`,
      field: 'codigoIbgeMunicipio',
      rule: 'LEDI-FAI',
    });
  }

  const profCnsRaw = tagRaw(xml, 'profissionalCNS');
  const profCns = (profCnsRaw || '').replace(/\D/g, '');
  if (!profCns) {
    findings.push({
      severity: 'BLOCKER',
      code: 'PROF_CNS_MISSING',
      message: 'CNS do profissional ausente no header/lotação.',
      field: 'profissionalCNS',
      rule: 'LEDI-FAI',
    });
  } else if (!isValidCns(profCns)) {
    findings.push({
      severity: 'MONEY_RISK',
      code: 'PROF_CNS_INVALID',
      message: 'CNS do profissional inválido.',
      field: 'profissionalCNS',
      rule: 'LEDI-FAI',
    });
  }

  const blocks = eachAtendimento(xml);
  if (!blocks.length) {
    findings.push({
      severity: 'BLOCKER',
      code: 'FAI_ATENDIMENTO_MISSING',
      message: 'Nenhum bloco atendimentosIndividuais.',
      field: 'atendimentosIndividuais',
      rule: 'LEDI-FAI',
    });
  }

  for (const body of blocks) {
    if (!/<stNaoPossuiCpf\b/i.test(body) && !/<stCidadaoNaoPossuiCpf\b/i.test(body)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'ST_NAO_POSSUI_CPF',
        message: 'Campo stNaoPossuiCpf ausente no atendimento individual.',
        field: 'stNaoPossuiCpf',
        rule: 'LEDI-FAI',
        hint: 'Inserir false quando há CNS/CPF.',
      });
    }

    const cpfRaw = tagRaw(body, 'cpfCidadao');
    const cnsRaw = tagRaw(body, 'cnsCidadao') ?? tagRaw(body, 'cns');
    const cpf = (cpfRaw || '').replace(/\D/g, '');
    const cns = (cnsRaw || '').replace(/\D/g, '');
    if (!cpf && !cns) {
      findings.push({
        severity: 'BLOCKER',
        code: 'PATIENT_ID_MISSING',
        message: 'Sem CPF nem CNS do cidadão.',
        field: 'cnsCidadao',
        rule: 'LEDI-FAI',
      });
    }
    if (cnsRaw && cnsRaw.replace(/\D/g, '') !== cnsRaw.trim() && isValidCns(cns)) {
      findings.push({
        severity: 'QUALITY_WARN',
        code: 'CNS_FORMAT',
        message: 'CNS com espaços ou pontuação — normaliza para 15 dígitos.',
        field: 'cnsCidadao',
        rule: 'LEDI-FAI',
      });
    }
    if (cpfRaw && cpfRaw.replace(/\D/g, '') !== cpfRaw.trim() && isValidCpf(cpf)) {
      findings.push({
        severity: 'QUALITY_WARN',
        code: 'CPF_FORMAT',
        message: 'CPF com espaços ou pontuação — normaliza para 11 dígitos.',
        field: 'cpfCidadao',
        rule: 'LEDI-FAI',
      });
    }
    if (cns && !isValidCns(cns)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'CNS_INVALID',
        message: 'CNS do cidadão inválido.',
        field: 'cnsCidadao',
        rule: 'LEDI-FAI',
      });
    }
    if (cpf && !isValidCpf(cpf)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'CPF_INVALID',
        message: 'CPF do cidadão inválido.',
        field: 'cpfCidadao',
        rule: 'LEDI-FAI',
      });
    }

    const stTrue =
      /<stNaoPossuiCpf>\s*true\s*<\/stNaoPossuiCpf>/i.test(body) ||
      /<stCidadaoNaoPossuiCpf>\s*true\s*<\/stCidadaoNaoPossuiCpf>/i.test(body);
    if (stTrue && !/<justificativaNaoPossuiCpf\b/i.test(body) && !/<justificativaCidadaoNaoPossuiCpf\b/i.test(body)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'JUSTIFICATIVA_CPF_MISSING',
        message: 'stNaoPossuiCpf=true exige justificativaNaoPossuiCpf.',
        field: 'justificativaNaoPossuiCpf',
        rule: 'LEDI-FAI',
      });
    }

    const turno = Number(body.match(/<turno>\s*([^<]+)/i)?.[1]?.trim());
    if (!Number.isFinite(turno) || ![1, 2, 3].includes(turno)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'TURNO',
        message: `Turno inválido (${turno || 'ausente'}); use 1, 2 ou 3.`,
        field: 'turno',
        rule: 'LEDI-FAI',
      });
    }

    if (!/<dtNascimento\b/i.test(body) && !/<dataNascimento\b/i.test(body)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'DT_NASCIMENTO_MISSING',
        message: 'dtNascimento/dataNascimento ausente.',
        field: 'dtNascimento',
        rule: 'LEDI-FAI',
      });
    }

    const nascRaw = tagRaw(body, 'dataNascimento') ?? tagRaw(body, 'dtNascimento');
    const nascMs = epochMs(nascRaw);
    const dataAtMs = epochMs(dataAtRaw);
    if (nascMs != null && dataAtMs != null && nascMs > dataAtMs) {
      findings.push({
        severity: 'BLOCKER',
        code: 'DT_NASCIMENTO_AFTER_ATEND',
        message: 'Data de nascimento posterior à data do atendimento.',
        field: 'dataNascimento',
        rule: 'LEDI-FAI',
      });
    }

    const sexo = body.match(/<sexo>\s*([^<]+)/i)?.[1]?.trim();
    if (sexo == null || sexo === '' || !['0', '1'].includes(sexo)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'SEXO_INVALID',
        message: `Sexo inválido (${sexo ?? 'ausente'}); use 0 ou 1.`,
        field: 'sexo',
        rule: 'LEDI-FAI',
      });
    }

    const localRaw =
      body.match(/<localAtendimento>\s*([^<]+)/i)?.[1]?.trim() ||
      body.match(/<localDeAtendimento>\s*([^<]+)/i)?.[1]?.trim();
    const local = Number(localRaw);
    if (!Number.isFinite(local) || local < 1 || local > 10) {
      findings.push({
        severity: 'BLOCKER',
        code: 'LOCAL_ATENDIMENTO',
        message: `localAtendimento inválido (${local || 'ausente'}).`,
        field: 'localAtendimento',
        rule: 'LEDI-FAI',
      });
    }

    const tipoAt = Number(body.match(/<tipoAtendimento>\s*([^<]+)/i)?.[1]?.trim());
    if (!FAI_TIPO_OK.has(tipoAt)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'TIPO_ATENDIMENTO',
        message: `tipoAtendimento FAI deve ser 1, 2, 4, 5 ou 6 (atual: ${Number.isFinite(tipoAt) ? tipoAt : 'ausente'}).`,
        field: 'tipoAtendimento',
        rule: 'LEDI-FAI',
      });
    }

    const condutas = [...body.matchAll(/<condutas>\s*(\d+)\s*<\/condutas>/gi)].map((x) => Number(x[1]));
    if (!condutas.length) {
      findings.push({
        severity: 'BLOCKER',
        code: 'CONDUTA_MISSING',
        message: 'Nenhuma conduta/encaminhamento (catálogo FAI / TipoEncaminhamentoIndividual).',
        field: 'condutas',
        rule: 'LEDI-FAI',
        hint: 'Sugestão LEDI (não aplicada em lote): 1 = retorno para consulta agendada.',
      });
    } else if (condutas.length > 14) {
      findings.push({
        severity: 'MONEY_RISK',
        code: 'CONDUTAS_MAX',
        message: `Condutas acima do limite (${condutas.length} > 14).`,
        field: 'condutas',
        rule: 'LEDI-FAI',
      });
    } else if (condutas.some((c) => !FAI_CONDUTA_OK.has(c))) {
      findings.push({
        severity: 'BLOCKER',
        code: 'CONDUTA_MISSING',
        message: 'Conduta fora do catálogo TipoEncaminhamentoIndividual (1–14).',
        field: 'condutas',
        rule: 'LEDI-FAI',
      });
    }

    const ciapRaw = tagRaw(body, 'ciap') ?? tagRaw(body, 'ciap2MotivoConsulta');
    const cidRaw = tagRaw(body, 'cid10') ?? tagRaw(body, 'cid10_2');
    const hasProblema =
      !!(ciapRaw && ciapRaw.trim()) ||
      !!(cidRaw && cidRaw.trim()) ||
      /<problemasCondicoes\b/i.test(body);
    if (!hasProblema) {
      findings.push({
        severity: 'BLOCKER',
        code: 'PROBLEMAS_MISSING',
        message: 'Informe ao menos um CIAP ou CID-10.',
        field: 'problemasCondicoes',
        rule: 'LEDI-FAI',
        hint: 'Não inventar diagnóstico — corrija na ficha.',
      });
    }
    if (ciapRaw && ciapRaw.trim()) {
      const n = ciapNorm(ciapRaw);
      if (n !== ciapRaw.trim() && /^[A-Z]\d{2}$/.test(n)) {
        findings.push({
          severity: 'QUALITY_WARN',
          code: 'CIAP_FORMAT',
          message: `CIAP com formato a normalizar ("${ciapRaw.trim()}").`,
          field: 'ciap',
          rule: 'LEDI-FAI',
        });
      }
    }
    if (cidRaw && cidRaw.trim()) {
      const n = cidNorm(cidRaw);
      if (n !== cidRaw.trim() && /^[A-Z]\d{2,4}(\.\d{1,2})?$/.test(n)) {
        findings.push({
          severity: 'QUALITY_WARN',
          code: 'CID_FORMAT',
          message: `CID-10 com formato a normalizar ("${cidRaw.trim()}").`,
          field: 'cid10',
          rule: 'LEDI-FAI',
        });
      }
    }

    for (const qm of body.matchAll(/<quantidade>\s*([^<]*)\s*<\/quantidade>/gi)) {
      const q = Number(String(qm[1]).trim());
      if (!Number.isFinite(q) || !Number.isInteger(q) || q < 1) {
        findings.push({
          severity: 'MONEY_RISK',
          code: 'PROC_QTD',
          message: `quantidade inválida (${String(qm[1]).trim() || 'vazia'}); mínimo 1.`,
          field: 'quantidade',
          rule: 'LEDI-FAI',
        });
      }
    }

    const horaIni = epochMs(tagRaw(body, 'dataHoraInicialAtendimento'));
    const horaFim = epochMs(tagRaw(body, 'dataHoraFinalAtendimento'));
    if (horaIni != null && horaFim != null && horaFim < horaIni) {
      findings.push({
        severity: 'BLOCKER',
        code: 'HORA_FIM_ANTES_INI',
        message: 'Fim do atendimento antes do início.',
        field: 'dataHoraFinalAtendimento',
        rule: 'LEDI-FAI',
      });
    }
  }

  const cnes =
    xml.match(/<cnesDadoSerializado>\s*([^<]+)/i)?.[1]?.replace(/\D/g, '') ||
    xml.match(/<cnes>\s*([^<]+)/i)?.[1]?.replace(/\D/g, '') ||
    '';
  if (!cnes) {
    findings.push({
      severity: 'BLOCKER',
      code: 'CNES_MISSING',
      message: 'CNES ausente.',
      field: 'cnes',
      rule: 'LEDI-FAI',
    });
  } else if (cnes.length !== 7) {
    findings.push({
      severity: 'BLOCKER',
      code: 'CNES_FORMAT',
      message: `CNES deve ter 7 dígitos (atual: ${cnes.length}).`,
      field: 'cnes',
      rule: 'LEDI-FAI',
    });
  }

  const ineLot =
    xml.match(/<lotacaoFormPrincipal[\s\S]*?<ine>\s*([^<]*)/i)?.[1]?.replace(/\D/g, '') ||
    xml.match(/<ineDadoSerializado>\s*([^<]+)/i)?.[1]?.replace(/\D/g, '') ||
    '';
  if (!ineLot) {
    findings.push({
      severity: 'QUALITY_WARN',
      code: 'INE_MISSING',
      message: 'INE ausente na lotação/envelope.',
      field: 'ine',
      rule: 'LEDI-FAI',
    });
  }

  return buildFaiReport(findings, 'xml', 'LEDI_FAI_XML');
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

/**
 * Valida payload JSON do mapper `ledi-individual-v2` (origem APS / FAI tipo 4).
 * Mesmos blockers estruturais do XML (identificação, turno, CNES, condutas, problema).
 */
export function validateFaiJson(master: Record<string, unknown>): FaiValidationReport {
  const findings: FaoFinding[] = [];
  const header = asRecord(master.headerTransport) || {};
  const children = asArray(master.atendimentosIndividuais);

  if (!children.length) {
    findings.push({
      severity: 'BLOCKER',
      code: 'FAI_ATENDIMENTO_MISSING',
      message: 'Nenhum atendimento individual no payload.',
      field: 'atendimentosIndividuais',
      rule: 'LEDI-FAI',
    });
  }

  for (const raw of children) {
    const body = asRecord(raw) || {};
    const st = body.stNaoPossuiCpf;
    if (typeof st !== 'boolean') {
      findings.push({
        severity: 'BLOCKER',
        code: 'ST_NAO_POSSUI_CPF',
        message: 'Campo stNaoPossuiCpf ausente no atendimento individual.',
        field: 'stNaoPossuiCpf',
        rule: 'LEDI-FAI',
        hint: 'Inserir false quando há CNS/CPF.',
      });
    }

    const cpf = str(body.cpfCidadao).replace(/\D/g, '');
    const cns = (str(body.cns) || str(body.cnsCidadao)).replace(/\D/g, '');
    if (!cpf && !cns) {
      findings.push({
        severity: 'BLOCKER',
        code: 'PATIENT_ID_MISSING',
        message: 'Sem CPF nem CNS do cidadão.',
        field: 'cns',
        rule: 'LEDI-FAI',
      });
    }
    if (cns && !isValidCns(cns)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'CNS_INVALID',
        message: 'CNS do cidadão inválido.',
        field: 'cns',
        rule: 'LEDI-FAI',
      });
    }
    if (cpf && !isValidCpf(cpf)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'CPF_INVALID',
        message: 'CPF do cidadão inválido.',
        field: 'cpfCidadao',
        rule: 'LEDI-FAI',
      });
    }
    if (st === true && (body.justificativaNaoPossuiCpf == null || body.justificativaNaoPossuiCpf === '')) {
      findings.push({
        severity: 'BLOCKER',
        code: 'JUSTIFICATIVA_CPF_MISSING',
        message: 'Informe justificativa de não possuir CPF.',
        field: 'justificativaNaoPossuiCpf',
        rule: 'LEDI-FAI',
      });
    }

    const turno = Number(body.turno);
    if (!Number.isFinite(turno) || ![1, 2, 3].includes(turno)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'TURNO',
        message: `Turno inválido (${body.turno ?? 'ausente'}); use 1, 2 ou 3.`,
        field: 'turno',
        rule: 'LEDI-FAI',
      });
    }

    const nasc = str(body.dataNascimento) || str(body.dtNascimento);
    if (!nasc) {
      findings.push({
        severity: 'BLOCKER',
        code: 'DT_NASCIMENTO_MISSING',
        message: 'dtNascimento/dataNascimento ausente.',
        field: 'dataNascimento',
        rule: 'LEDI-FAI',
      });
    }

    const sexo = body.sexo;
    if (sexo !== 0 && sexo !== 1 && sexo !== '0' && sexo !== '1') {
      findings.push({
        severity: 'BLOCKER',
        code: 'SEXO_INVALID',
        message: `Sexo inválido (${sexo ?? 'ausente'}); use 0 ou 1.`,
        field: 'sexo',
        rule: 'LEDI-FAI',
      });
    }

    const local = Number(body.localDeAtendimento ?? body.localAtendimento);
    if (!Number.isFinite(local) || local < 1 || local > 10) {
      findings.push({
        severity: 'BLOCKER',
        code: 'LOCAL_ATENDIMENTO',
        message: `localAtendimento inválido (${local || 'ausente'}).`,
        field: 'localDeAtendimento',
        rule: 'LEDI-FAI',
      });
    }

    const tipo = Number(body.tipoAtendimento);
    if (!FAI_TIPO_OK.has(tipo)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'TIPO_ATENDIMENTO',
        message: `tipoAtendimento FAI deve ser 1, 2, 4, 5 ou 6 (atual: ${body.tipoAtendimento ?? 'ausente'}).`,
        field: 'tipoAtendimento',
        rule: 'LEDI-FAI',
      });
    }

    const condutas = asArray(body.condutas);
    if (!condutas.length) {
      findings.push({
        severity: 'BLOCKER',
        code: 'CONDUTA_MISSING',
        message: 'Nenhuma conduta/encaminhamento (catálogo FAI / TipoEncaminhamentoIndividual).',
        field: 'condutas',
        rule: 'LEDI-FAI',
      });
    }

    const problema = asRecord(body.problemaCondicaoAvaliada) || {};
    const ciaps = asArray(problema.ciaps).concat(asArray(body.ciap2MotivoConsulta));
    const cids = asArray(problema.cid10);
    const hasProblema = ciaps.some((x) => str(x)) || cids.some((x) => str(x));
    if (!hasProblema) {
      findings.push({
        severity: 'BLOCKER',
        code: 'PROBLEMAS_MISSING',
        message: 'Informe ao menos um CIAP ou CID-10.',
        field: 'problemasCondicoes',
        rule: 'LEDI-FAI',
      });
    }
  }

  const lotacao = asRecord(header.lotacaoFormPrincipal) || header;
  const cnes = (str(lotacao.cnes) || str(header.cnes)).replace(/\D/g, '');
  if (!cnes) {
    findings.push({
      severity: 'BLOCKER',
      code: 'CNES_MISSING',
      message: 'CNES ausente.',
      field: 'cnes',
      rule: 'LEDI-FAI',
    });
  } else if (cnes.length !== 7) {
    findings.push({
      severity: 'BLOCKER',
      code: 'CNES_FORMAT',
      message: `CNES deve ter 7 dígitos (atual: ${cnes.length}).`,
      field: 'cnes',
      rule: 'LEDI-FAI',
    });
  }

  const ineLot = (str(lotacao.ine) || str(header.ine)).replace(/\D/g, '');
  if (!ineLot) {
    findings.push({
      severity: 'QUALITY_WARN',
      code: 'INE_MISSING',
      message: 'INE ausente na lotação/envelope.',
      field: 'ine',
      rule: 'LEDI-FAI',
    });
  }

  return buildFaiReport(findings, 'json', 'ledi-individual-v2');
}

function buildFaiReport(
  findings: FaoFinding[],
  sourceKind: 'xml' | 'json',
  detectedFormat: string,
): FaiValidationReport {
  const blockers = count(findings, 'BLOCKER');
  const moneyRisks = count(findings, 'MONEY_RISK');
  const qualityWarns = count(findings, 'QUALITY_WARN');
  const infos = count(findings, 'INFO');
  const siapsReady = blockers === 0;
  return {
    conformant: siapsReady && moneyRisks === 0,
    siapsReady,
    previneReady: true,
    readyForFinalSend: siapsReady,
    channel: 'LEDI_FAI_SIAPS',
    sourceKind,
    detectedFormat,
    summary: { blockers, moneyRisks, qualityWarns, infos },
    findings,
  };
}
