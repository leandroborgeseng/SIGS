/**
 * Validador de conformidade — Ficha de Atendimento Odontológico Individual (LEDI FAO).
 *
 * Cadeia oficial para produção odonto APS / CEO→Siaps (Portaria GM/MS 10.192/2026):
 *   LEDI FAO (XML|Thrift) → PEC e-SUS APS / Siaps → RNDS
 *
 * Este módulo não envia à RNDS; emite críticas BLOCKER / MONEY_RISK / QUALITY_WARN
 * conforme dicionário LEDI FAO (e-SUS APS / Bridge UFSC).
 */

import { extractFaoMasterFromXml } from './ledi-fao-xml.parser';
import { analyzePrevineEsbXray, type PrevineXray } from './ledi-fao-previne-xray';

export type FaoSeverity = 'BLOCKER' | 'MONEY_RISK' | 'QUALITY_WARN' | 'INFO';

export type FaoFinding = {
  severity: FaoSeverity;
  code: string;
  message: string;
  field?: string;
  rule?: string;
  hint?: string;
  rndsImpact?: string;
};

export type FaoValidationReport = {
  conformant: boolean;
  /** Aceite estrutural Siaps (sem BLOCKER). */
  siapsReady: boolean;
  /** Sem MONEY_RISK no raio-x Previne ESB. */
  previneReady: boolean;
  /** Pronto para envio final recomendado: Siaps ok + sem MONEY_RISK Previne. */
  readyForFinalSend: boolean;
  channel: 'LEDI_FAO_SIAPS_RNDS';
  sourceKind: 'xml' | 'json';
  detectedFormat: string;
  summary: {
    blockers: number;
    moneyRisks: number;
    qualityWarns: number;
    infos: number;
  };
  findings: FaoFinding[];
  /** Raio-x de indicadores ESB / qualidade (não bloqueia parse). */
  previneXray?: PrevineXray;
  masterPreview?: {
    uuidFicha?: string;
    cnes?: string;
    cbo?: string;
    atendimentoCount?: number;
  };
};

/** CBOs que podem registrar FAO (Tabela 4 LEDI — família odonto + TSB/ASB). */
export const FAO_ALLOWED_CBOS = new Set([
  '223204',
  '223208',
  '223212',
  '223216',
  '223220',
  '223224',
  '223228',
  '223232',
  '223236',
  '223240',
  '223244',
  '223248',
  '223252',
  '223256',
  '223260',
  '223264',
  '223268',
  '223272',
  '223276',
  '223280',
  '223284',
  '223288',
  '223293',
  '322405', // ASB
  '322415',
  '322420',
  '322425',
  '322430', // TSB/ESF
]);

const TIPO_ATENDIMENTO_OK = new Set([2, 4, 5, 6]);
const LOCAL_OK = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
const TURNO_OK = new Set([1, 2, 3]);
const SEXO_OK = new Set([0, 1]); // 0 masc, 1 fem (LEDI)
const PROCEDIMENTO_ESCUTA = '0301040079';

function push(
  findings: FaoFinding[],
  severity: FaoSeverity,
  code: string,
  message: string,
  extra?: Partial<FaoFinding>,
) {
  findings.push({ severity, code, message, ...extra });
}

function str(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asArray(v: unknown): unknown[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** Algoritmo CNS (soma ponderada módulo 11) — alinhado à validação LEDI. */
export function isValidCns(cnsRaw: string): boolean {
  const cns = cnsRaw.replace(/\D/g, '');
  if (cns.length !== 15) return false;
  if (/^(\d)\1+$/.test(cns)) return false;
  if (!/^[12789]/.test(cns)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) sum += Number(cns[i]) * (15 - i);
  return sum % 11 === 0;
}

/** Validação CPF (dígitos verificadores). */
export function isValidCpf(cpfRaw: string): boolean {
  const cpf = cpfRaw.replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;
  const calc = (base: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += Number(base[i]) * (factor - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  const d1 = calc(cpf.slice(0, 9), 10);
  const d2 = calc(cpf.slice(0, 10), 11);
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

function epochMs(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v > 1e12 ? v : v * 1000;
  const s = String(v).trim();
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return n > 1e12 ? n : n * 1000;
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

function validateUuidFicha(findings: FaoFinding[], uuid: string) {
  if (!uuid) {
    push(findings, 'BLOCKER', 'UUID_FICHA_MISSING', 'uuidFicha obrigatório (36–44 chars).', {
      field: 'uuidFicha',
      rule: 'FAO#1',
      rndsImpact: 'Sem UUID a ficha não rastreia no Siaps/RNDS.',
    });
    return;
  }
  if (uuid.length < 36 || uuid.length > 44) {
    push(findings, 'MONEY_RISK', 'UUID_FICHA_LENGTH', `uuidFicha com ${uuid.length} chars (esperado 36–44).`, {
      field: 'uuidFicha',
      rule: 'FAO#1',
      hint: 'Recomendado: CNES(7)+hífen+UUID canônico.',
      rndsImpact: 'Risco de rejeição no transporte LEDI.',
    });
  }
}

function validateHeader(findings: FaoFinding[], header: Record<string, unknown>) {
  const lotacao = asRecord(header.lotacaoFormPrincipal) || {};
  const cnsProf = str(header.profissionalCNS || lotacao.profissionalCNS);
  const cbo = str(header.cboCodigo_2002 || lotacao.cboCodigo_2002 || header.cbo);
  const cnes = str(header.cnes || lotacao.cnes);
  const ine = str(header.ine || lotacao.ine);
  const ibge = str(header.codigoIbgeMunicipio || header.codIbge);
  const dataAtendimento = header.dataAtendimento;

  if (!cnsProf) {
    push(findings, 'BLOCKER', 'PROF_CNS_MISSING', 'CNS do profissional ausente no header/lotação.', {
      field: 'headerTransport.profissionalCNS',
      rule: 'FAO#2 VariasLotacoesHeader',
      rndsImpact: 'Lotação incompleta → rejeição Siaps.',
    });
  } else if (!isValidCns(cnsProf)) {
    push(findings, 'MONEY_RISK', 'PROF_CNS_INVALID', `CNS profissional inválido: ${cnsProf}.`, {
      field: 'headerTransport.profissionalCNS',
      rule: 'algoritmo CNS',
    });
  }

  if (!cbo) {
    push(findings, 'BLOCKER', 'CBO_MISSING', 'CBO 2002 ausente na lotação odonto.', {
      field: 'headerTransport.cboCodigo_2002',
      rule: 'Tabela 4 CBO FAO',
      rndsImpact: 'Sem CBO odonto a ficha não é aceita.',
    });
  } else if (!FAO_ALLOWED_CBOS.has(cbo)) {
    push(
      findings,
      'BLOCKER',
      'CBO_NOT_ODONTO',
      `CBO ${cbo} não está na Tabela 4 (CBOs que registram FAO).`,
      {
        field: 'headerTransport.cboCodigo_2002',
        rule: 'Tabela 4',
        hint: 'Use CBO 2232xx (CD) ou 3224xx (TSB/ASB) permitidos.',
        rndsImpact: 'Rejeição imediata no LEDI/Siaps.',
      },
    );
  }

  if (!cnes) {
    push(findings, 'BLOCKER', 'CNES_MISSING', 'CNES da unidade ausente.', {
      field: 'headerTransport.cnes',
      rndsImpact: 'Produção sem CNES não entra no Siaps.',
    });
  } else if (!/^\d{7}$/.test(cnes)) {
    push(findings, 'MONEY_RISK', 'CNES_FORMAT', `CNES "${cnes}" deve ter 7 dígitos.`, {
      field: 'headerTransport.cnes',
    });
  }

  if (!ibge) {
    push(findings, 'MONEY_RISK', 'IBGE_MISSING', 'código IBGE do município ausente no header.', {
      field: 'headerTransport.codigoIbgeMunicipio',
      hint: 'Cadastre IBGE 7 dígitos na unidade (Franca=3516200).',
      rndsImpact: 'Fichas sem IBGE tendem a rejeição.',
    });
  } else if (!/^\d{7}$/.test(ibge)) {
    push(findings, 'MONEY_RISK', 'IBGE_FORMAT', `IBGE "${ibge}" inválido.`, {
      field: 'headerTransport.codigoIbgeMunicipio',
    });
  }

  if (!ine) {
    push(findings, 'QUALITY_WARN', 'INE_MISSING', 'INE da equipe ausente (recomendado em APS).', {
      field: 'headerTransport.ine',
    });
  }

  if (dataAtendimento == null || dataAtendimento === '') {
    push(findings, 'BLOCKER', 'DATA_ATENDIMENTO_MISSING', 'dataAtendimento obrigatória no header.', {
      field: 'headerTransport.dataAtendimento',
    });
  }

  return { cnes, cbo, dataAtendimento };
}

function validateChild(
  findings: FaoFinding[],
  child: Record<string, unknown>,
  index: number,
  headerMeta: { dataAtendimento: unknown },
) {
  const prefix = `atendimentosOdontologicos[${index}]`;

  const cpf = str(child.cpfCidadao);
  const cns = str(child.cnsCidadao);
  const stNaoPossuiCpf = child.stNaoPossuiCpf === true || child.stNaoPossuiCpf === 'true';

  if (cpf && cns) {
    push(
      findings,
      'BLOCKER',
      'CPF_CNS_BOTH',
      'Não pode informar CPF e CNS juntos no mesmo atendimento.',
      {
        field: `${prefix}.cpfCidadao/cnsCidadao`,
        rule: 'FAO#2/#19',
        rndsImpact: 'Rejeição LEDI.',
      },
    );
  }
  if (!cpf && !cns && !stNaoPossuiCpf) {
    push(
      findings,
      'BLOCKER',
      'PATIENT_ID_MISSING',
      'Informe CPF ou CNS do cidadão (ou stNaoPossuiCpf=true + justificativa).',
      {
        field: `${prefix}.cpf/cns`,
        rule: 'FAO#2/#19/#29',
        rndsImpact: 'Ficha sem identificação não individualiza produção → Siaps/RNDS.',
      },
    );
  }
  if (cpf && !isValidCpf(cpf)) {
    push(findings, 'BLOCKER', 'CPF_INVALID', `CPF inválido: ${cpf}.`, {
      field: `${prefix}.cpfCidadao`,
      rule: 'algoritmo CPF',
    });
  }
  if (cns && !isValidCns(cns)) {
    push(findings, 'BLOCKER', 'CNS_INVALID', `CNS cidadão inválido: ${cns}.`, {
      field: `${prefix}.cnsCidadao`,
      rule: 'algoritmo CNS',
    });
  }
  if (stNaoPossuiCpf && child.justificativaNaoPossuiCpf == null) {
    push(
      findings,
      'BLOCKER',
      'JUSTIFICATIVA_CPF_MISSING',
      'stNaoPossuiCpf=true exige justificativaNaoPossuiCpf.',
      { field: `${prefix}.justificativaNaoPossuiCpf`, rule: 'FAO#30' },
    );
  }
  if (!stNaoPossuiCpf && child.justificativaNaoPossuiCpf != null) {
    push(
      findings,
      'MONEY_RISK',
      'JUSTIFICATIVA_CPF_UNEXPECTED',
      'justificativaNaoPossuiCpf só é permitida com stNaoPossuiCpf=true.',
      { field: `${prefix}.justificativaNaoPossuiCpf`, rule: 'FAO#30' },
    );
  }

  if (child.dtNascimento == null || child.dtNascimento === '') {
    push(findings, 'BLOCKER', 'DT_NASCIMENTO_MISSING', 'dtNascimento obrigatória.', {
      field: `${prefix}.dtNascimento`,
      rule: 'FAO#1',
    });
  }

  const sexo = num(child.sexo);
  if (sexo == null || !SEXO_OK.has(sexo)) {
    push(findings, 'BLOCKER', 'SEXO_INVALID', 'sexo obrigatório (0=masculino, 1=feminino).', {
      field: `${prefix}.sexo`,
      rule: 'FAO#14',
    });
  }

  const gestante = child.gestante;
  if (gestante === undefined || gestante === null || gestante === '') {
    push(findings, 'BLOCKER', 'GESTANTE_MISSING', 'campo gestante é obrigatório (boolean).', {
      field: `${prefix}.gestante`,
      rule: 'FAO#4',
    });
  } else if ((gestante === true || gestante === 'true') && sexo === 0) {
    push(findings, 'BLOCKER', 'GESTANTE_SEXO_MASC', 'gestante=true incompatível com sexo masculino.', {
      field: `${prefix}.gestante`,
      rule: 'FAO#4',
    });
  }

  const local = num(child.localAtendimento);
  if (local == null || !LOCAL_OK.has(local)) {
    push(findings, 'BLOCKER', 'LOCAL_ATENDIMENTO', 'localAtendimento obrigatório (1–10).', {
      field: `${prefix}.localAtendimento`,
      rule: 'FAO#6',
    });
  }

  const tipoAtendimento = num(child.tipoAtendimento);
  if (tipoAtendimento == null || !TIPO_ATENDIMENTO_OK.has(tipoAtendimento)) {
    push(
      findings,
      'BLOCKER',
      'TIPO_ATENDIMENTO',
      'tipoAtendimento obrigatório: 2, 4, 5 ou 6.',
      {
        field: `${prefix}.tipoAtendimento`,
        rule: 'FAO#7',
        hint: '2=consulta agendada, 4=escuta/orientação, 5=consulta no dia, 6=urgência.',
      },
    );
  }

  const turno = num(child.turno);
  if (turno == null || !TURNO_OK.has(turno)) {
    push(findings, 'BLOCKER', 'TURNO', 'turno obrigatório (1=manhã, 2=tarde, 3=noite).', {
      field: `${prefix}.turno`,
      rule: 'FAO#15',
    });
  }

  const encams = asArray(child.tiposEncamOdonto).map(num).filter((n): n is number => n != null);
  if (!encams.length) {
    push(findings, 'BLOCKER', 'CONDUTAS_MISSING', 'tiposEncamOdonto obrigatório (1–17 itens).', {
      field: `${prefix}.tiposEncamOdonto`,
      rule: 'FAO#8',
      rndsImpact: 'Sem conduta/desfecho a produção odonto não fecha.',
    });
  } else if (encams.length > 17) {
    push(findings, 'MONEY_RISK', 'CONDUTAS_MAX', 'tiposEncamOdonto excede 17 itens.', {
      field: `${prefix}.tiposEncamOdonto`,
      rule: 'FAO#8',
    });
  }

  const vigilancia = asArray(child.tiposVigilanciaSaudeBucal)
    .map(num)
    .filter((n): n is number => n != null);
  if (!vigilancia.length) {
    push(
      findings,
      'BLOCKER',
      'VIGILANCIA_MISSING',
      'tiposVigilanciaSaudeBucal obrigatório (RF-12.7 / FAO#10).',
      {
        field: `${prefix}.tiposVigilanciaSaudeBucal`,
        rule: 'FAO#10',
        rndsImpact: 'Finalização com vigilância em saúde bucal é crítica para conformidade.',
      },
    );
  } else if (vigilancia.length > 7) {
    push(findings, 'MONEY_RISK', 'VIGILANCIA_MAX', 'tiposVigilanciaSaudeBucal excede 7 itens.', {
      field: `${prefix}.tiposVigilanciaSaudeBucal`,
    });
  }

  const tiposConsulta = asArray(child.tiposConsultaOdonto)
    .map(num)
    .filter((n): n is number => n != null);
  if (tipoAtendimento === 2 && !tiposConsulta.length) {
    push(
      findings,
      'BLOCKER',
      'TIPO_CONSULTA_REQUIRED',
      'tiposConsultaOdonto obrigatório quando tipoAtendimento=2 (consulta agendada).',
      { field: `${prefix}.tiposConsultaOdonto`, rule: 'FAO#11' },
    );
  }
  if (tipoAtendimento === 4 && tiposConsulta.length) {
    push(
      findings,
      'BLOCKER',
      'TIPO_CONSULTA_FORBIDDEN',
      'tiposConsultaOdonto não pode ser preenchido em escuta inicial (tipoAtendimento=4).',
      { field: `${prefix}.tiposConsultaOdonto`, rule: 'FAO#11' },
    );
  }
  if (tipoAtendimento === 6 && tiposConsulta.includes(2)) {
    push(
      findings,
      'BLOCKER',
      'TIPO_CONSULTA_URGENCIA',
      'Em urgência (6), não marcar consulta de retorno (2).',
      { field: `${prefix}.tiposConsultaOdonto`, rule: 'FAO#11' },
    );
  }
  if (tiposConsulta.length > 1) {
    push(findings, 'MONEY_RISK', 'TIPO_CONSULTA_MULTI', 'tiposConsultaOdonto aceita no máximo 1 item.', {
      field: `${prefix}.tiposConsultaOdonto`,
      rule: 'FAO#11',
    });
  }

  // Condutas × tipo consulta
  const hasPrimeiraOuRetorno = tiposConsulta.includes(1) || tiposConsulta.includes(2);
  if (encams.includes(15) && !hasPrimeiraOuRetorno) {
    push(
      findings,
      'BLOCKER',
      'TRATAMENTO_CONCLUIDO_RULE',
      'Conduta 15 (tratamento concluído) exige tiposConsultaOdonto 1 ou 2.',
      { field: `${prefix}.tiposEncamOdonto`, rule: 'FAO#8' },
    );
  }
  if (encams.includes(17) && hasPrimeiraOuRetorno) {
    push(
      findings,
      'BLOCKER',
      'ALTA_EPISODIO_RULE',
      'Conduta 17 (alta do episódio) incompatível com tiposConsultaOdonto 1 ou 2.',
      { field: `${prefix}.tiposEncamOdonto`, rule: 'FAO#8' },
    );
  }

  const ini = epochMs(child.dataHoraInicialAtendimento);
  const fim = epochMs(child.dataHoraFinalAtendimento);
  if (ini == null) {
    push(findings, 'BLOCKER', 'HORA_INI_MISSING', 'dataHoraInicialAtendimento obrigatória (epoch ms).', {
      field: `${prefix}.dataHoraInicialAtendimento`,
      rule: 'FAO#17',
    });
  }
  if (fim == null) {
    push(findings, 'BLOCKER', 'HORA_FIM_MISSING', 'dataHoraFinalAtendimento obrigatória (epoch ms).', {
      field: `${prefix}.dataHoraFinalAtendimento`,
      rule: 'FAO#18',
    });
  }
  if (ini != null && fim != null && fim < ini) {
    push(findings, 'BLOCKER', 'HORA_FIM_ANTES_INI', 'dataHoraFinalAtendimento anterior à inicial.', {
      field: `${prefix}.dataHoraFinalAtendimento`,
      rule: 'FAO#18',
    });
  }

  const dataAt = epochMs(headerMeta.dataAtendimento);
  if (dataAt != null && ini != null && ini < dataAt) {
    push(
      findings,
      'MONEY_RISK',
      'HORA_INI_ANTES_DATA',
      'dataHoraInicialAtendimento anterior à dataAtendimento do header.',
      { field: `${prefix}.dataHoraInicialAtendimento`, rule: 'FAO#17' },
    );
  }

  const procs = asArray(child.procedimentosRealizados);
  const codes = new Set<string>();
  for (const p of procs) {
    const r = asRecord(p) || {};
    const code = str(r.coMsProcedimento || r.codigo).replace(/\D/g, '');
    if (!code) {
      push(findings, 'MONEY_RISK', 'PROC_CODE_EMPTY', 'procedimento sem coMsProcedimento.', {
        field: `${prefix}.procedimentosRealizados`,
      });
      continue;
    }
    if (code === PROCEDIMENTO_ESCUTA) {
      push(
        findings,
        'BLOCKER',
        'PROC_ESCUTA_FORBIDDEN',
        'Não use 0301040079 em procedimentos — registre via tipoAtendimento=4.',
        { field: `${prefix}.procedimentosRealizados`, rule: 'FAO ProcedimentoQuantidade' },
      );
    }
    if (codes.has(code)) {
      push(findings, 'BLOCKER', 'PROC_DUPLICATE', `procedimento ${code} repetido.`, {
        field: `${prefix}.procedimentosRealizados`,
        rule: 'sem repetição',
      });
    }
    codes.add(code);
    const qtd = num(r.quantidade) ?? 1;
    if (qtd < 1) {
      push(findings, 'MONEY_RISK', 'PROC_QTD', `quantidade inválida para ${code}.`, {
        field: `${prefix}.procedimentosRealizados.quantidade`,
      });
    }
  }

  const problemas = asArray(child.problemasCondicoes ?? child.problemaCondicao);
  if (!problemas.length) {
    push(
      findings,
      'BLOCKER',
      'PROBLEMAS_MISSING',
      'problemasCondicoes obrigatório (≥1) — CIAP e/ou CID10.',
      {
        field: `${prefix}.problemasCondicoes`,
        rule: 'FAO#26',
        rndsImpact: 'Sem problema/condição a granularidade clínica para RNDS fica incompleta.',
      },
    );
  } else {
    for (const [i, prob] of problemas.entries()) {
      const r = asRecord(prob) || {};
      const ciap = str(r.ciap);
      const cid10 = str(r.cid10 ?? r.cid);
      if (!ciap && !cid10) {
        push(
          findings,
          'BLOCKER',
          'PROBLEMA_SEM_CODIGO',
          `problemasCondicoes[${i}] sem CIAP e sem CID10.`,
          { field: `${prefix}.problemasCondicoes[${i}]`, rule: 'ProblemaCondicao' },
        );
      }
    }
  }

  if (child.stNaoPossuiCpf === undefined || child.stNaoPossuiCpf === null || child.stNaoPossuiCpf === '') {
    push(findings, 'BLOCKER', 'ST_NAO_POSSUI_CPF', 'stNaoPossuiCpf é obrigatório (boolean).', {
      field: `${prefix}.stNaoPossuiCpf`,
      rule: 'FAO#29',
    });
  }
}

export function validateFaoMaster(master: Record<string, unknown>): FaoFinding[] {
  const findings: FaoFinding[] = [];
  validateUuidFicha(findings, str(master.uuidFicha));

  const tp = num(master.tpCdsOrigem);
  if (tp == null) {
    push(findings, 'BLOCKER', 'TP_CDS_ORIGEM_MISSING', 'tpCdsOrigem obrigatório.', {
      field: 'tpCdsOrigem',
      rule: 'FAO#4',
    });
  } else if (tp !== 3) {
    push(
      findings,
      'MONEY_RISK',
      'TP_CDS_ORIGEM_NOT_3',
      `tpCdsOrigem=${tp}; sistemas terceiros devem usar 3.`,
      {
        field: 'tpCdsOrigem',
        rule: 'FAO#4',
        hint: 'SIGS deve enviar tpCdsOrigem=3.',
        rndsImpact: 'Origem incorreta pode rejeitar lote LEDI.',
      },
    );
  }

  const header = asRecord(master.headerTransport) || {};
  const headerMeta = validateHeader(findings, header);

  const children = asArray(master.atendimentosOdontologicos);
  if (!children.length) {
    push(findings, 'BLOCKER', 'ATENDIMENTOS_EMPTY', 'atendimentosOdontologicos deve ter 1–99 itens.', {
      field: 'atendimentosOdontologicos',
      rule: 'FAO#3',
    });
  } else if (children.length > 99) {
    push(findings, 'MONEY_RISK', 'ATENDIMENTOS_MAX', 'mais de 99 atendimentos na ficha.', {
      field: 'atendimentosOdontologicos',
    });
  } else {
    children.forEach((c, i) => {
      const child = asRecord(c) || {};
      validateChild(findings, child, i, headerMeta);
    });
  }

  return findings;
}

export function validateFaoXml(xml: string): FaoValidationReport {
  let extracted;
  try {
    extracted = extractFaoMasterFromXml(xml);
  } catch (e) {
    const findings: FaoFinding[] = [
      {
        severity: 'BLOCKER',
        code: 'XML_PARSE_ERROR',
        message: (e as Error).message,
        hint: 'Envie XML LEDI FAO bem formado (FichaAtendimentoOdontologicoMaster).',
      },
    ];
    return buildReport('xml', 'parse-error', findings);
  }

  if (extracted.kind === 'fhir-bundle') {
    const findings: FaoFinding[] = [
      {
        severity: 'BLOCKER',
        code: 'FORMAT_FHIR_NOT_FAO',
        message:
          'XML/Bundle FHIR detectado. Produção odonto APS/CEO→Siaps usa LEDI FAO (não Bundle RIA direto neste fluxo).',
        hint: 'Importe a Ficha de Atendimento Odontológico Individual em XML LEDI, ou gere via /odonto → lote dental_encounter.',
        rndsImpact:
          'RIA FHIR (RF-10.7) é outro canal; odonto Siaps/RNDS via e-SUS exige LEDI FAO conforme Portaria 10.192/2026.',
      },
    ];
    return buildReport('xml', 'fhir-bundle', findings);
  }

  if (extracted.kind === 'dado-transport') {
    const findings: FaoFinding[] = [
      {
        severity: 'BLOCKER',
        code: 'FORMAT_DADO_TRANSPORT',
        message:
          'Envelope dadoTransport detectado. O payload serializado (Thrift binário) precisa ser a FAO; este validador espera XML estruturado da ficha.',
        hint: 'Exporte/serialize a FichaAtendimentoOdontologicoMaster em XML LEDI ou cole o JSON do lote.',
        rndsImpact: 'Envelope sem FAO decodificada não passa conformidade clínica.',
      },
    ];
    return buildReport('xml', 'dado-transport', findings);
  }

  if (!extracted.master) {
    const findings: FaoFinding[] = [
      {
        severity: 'BLOCKER',
        code: 'FAO_ROOT_NOT_FOUND',
        message: `Raiz <${extracted.rootName}> não contém FichaAtendimentoOdontologicoMaster reconhecível.`,
        hint: 'Cole XML com uuidFicha + headerTransport + atendimentosOdontologicos.',
      },
    ];
    return buildReport('xml', extracted.kind, findings);
  }

  const findings = validateFaoMaster(extracted.master);
  const header = asRecord(extracted.master.headerTransport) || {};
  const previneXray = analyzePrevineEsbXray(extracted.master);
  return buildReport('xml', 'ledi-fao', findings, {
    uuidFicha: str(extracted.master.uuidFicha) || undefined,
    cnes: str(header.cnes) || undefined,
    cbo: str(header.cboCodigo_2002) || undefined,
    atendimentoCount: asArray(extracted.master.atendimentosOdontologicos).length,
  }, previneXray);
}

export function validateFaoJson(master: Record<string, unknown>): FaoValidationReport {
  const findings = validateFaoMaster(master);
  const header = asRecord(master.headerTransport) || {};
  const previneXray = analyzePrevineEsbXray(master);
  return buildReport('json', 'ledi-fao', findings, {
    uuidFicha: str(master.uuidFicha) || undefined,
    cnes: str(header.cnes) || undefined,
    cbo: str(header.cboCodigo_2002) || undefined,
    atendimentoCount: asArray(master.atendimentosOdontologicos).length,
  }, previneXray);
}

function buildReport(
  sourceKind: 'xml' | 'json',
  detectedFormat: string,
  findings: FaoFinding[],
  masterPreview?: FaoValidationReport['masterPreview'],
  previneXray?: PrevineXray,
): FaoValidationReport {
  const blockers = findings.filter((f) => f.severity === 'BLOCKER').length;
  const moneyRisks = findings.filter((f) => f.severity === 'MONEY_RISK').length;
  const qualityWarns = findings.filter((f) => f.severity === 'QUALITY_WARN').length;
  const infos = findings.filter((f) => f.severity === 'INFO').length;
  const siapsReady = blockers === 0;
  const previneReady = !previneXray || previneXray.summary.moneyRisks === 0;
  return {
    conformant: blockers === 0 && moneyRisks === 0,
    siapsReady,
    previneReady,
    readyForFinalSend: siapsReady && previneReady,
    channel: 'LEDI_FAO_SIAPS_RNDS',
    sourceKind,
    detectedFormat,
    summary: { blockers, moneyRisks, qualityWarns, infos },
    findings,
    previneXray,
    masterPreview,
  };
}
