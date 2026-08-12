/** Pré-envio de produção/faturamento — relatório de bloqueios e riscos financeiros. */

export type FindingSeverity = 'BLOCKER' | 'MONEY_RISK' | 'QUALITY_WARN';

export type PreflightFinding = {
  code: string;
  severity: FindingSeverity;
  message: string;
  field?: string;
  hint?: string;
  moneyImpact?: string;
};

export type BatchPreflight = {
  batchId: string;
  kind: string;
  status: string;
  createdAt: string;
  competencia: string;
  procedureCode?: string;
  procedureLabel?: string;
  findings: PreflightFinding[];
  blockers: number;
  moneyRisks: number;
  qualityWarns: number;
  canSendAlone: boolean;
};

export type PreflightReport = {
  generatedAt: string;
  competencia?: string;
  statusFilter: string[];
  totals: {
    batches: number;
    ready: number;
    blockers: number;
    moneyRisks: number;
    qualityWarns: number;
    canSend: boolean;
  };
  summary: {
    missingStructures: string[];
    sendBlockers: string[];
    productionLossRisks: string[];
    moneyLossRisks: string[];
  };
  batches: BatchPreflight[];
  sigtap: {
    known: number;
    unknown: number;
    unknownCodes: string[];
  };
  checklist: Array<{ id: string; ok: boolean; label: string }>;
  rfIds: string[];
};

export type BatchLike = {
  id: string;
  kind: string;
  status: string;
  createdAt: Date | string;
  payloadJson?: string;
  payload?: Record<string, unknown>;
};

const KIND_PROC: Record<string, { code: string; label: string }> = {
  individual_encounter: { code: '0301010064', label: 'Consulta médica APS (stub)' },
  vaccination: { code: '0301010030', label: 'Aplicação de imunobiológico (stub)' },
  dental_encounter: { code: '0101020010', label: 'Consulta odontológica APS (stub)' },
  home_care: { code: '0101040024', label: 'Atendimento domiciliar APS (stub)' },
  collective_activity: { code: '0101050011', label: 'Atividade coletiva / educação em saúde (stub)' },
};

function competenciaFrom(d: Date | string) {
  const dt = typeof d === 'string' ? new Date(d) : d;
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
}

function payloadOf(b: BatchLike): Record<string, unknown> | null {
  if (b.payload && typeof b.payload === 'object') return b.payload;
  try {
    return JSON.parse(b.payloadJson || '{}') as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

function headerOf(p: Record<string, unknown>) {
  return asRecord(p.headerTransport) || {};
}

function childOf(kind: string, p: Record<string, unknown>): Record<string, unknown> {
  if (kind === 'individual_encounter') {
    const list = p.atendimentosIndividuais;
    if (Array.isArray(list) && list[0]) return asRecord(list[0]) || {};
  }
  if (kind === 'vaccination') {
    const list = p.vacinacoesIndividuais;
    if (Array.isArray(list) && list[0]) return asRecord(list[0]) || {};
  }
  if (kind === 'dental_encounter') {
    const list = p.atendimentosOdontologicos;
    if (Array.isArray(list) && list[0]) return asRecord(list[0]) || {};
    return asRecord(p.fichaOdontoTransport) || {};
  }
  if (kind === 'home_care') {
    const list = p.atendimentosDomiciliares;
    if (Array.isArray(list) && list[0]) return asRecord(list[0]) || {};
    return asRecord(p.fichaAdTransport) || {};
  }
  if (kind === 'collective_activity') {
    return (
      asRecord(p.fichaAtividadeColetivaTransport) || {
        numParticipantes: p.numParticipantes ?? p.participantCount,
      }
    );
  }
  return (
    asRecord(p.fichaOdontoTransport) ||
    asRecord(p.fichaAdTransport) ||
    asRecord(p.fichaAtividadeColetivaTransport) ||
    asRecord(p.fichaAtendimentoIndividualTransport) ||
    asRecord(p.fichaVacinacaoTransport) ||
    {}
  );
}

function push(
  findings: PreflightFinding[],
  severity: FindingSeverity,
  code: string,
  message: string,
  extra?: Partial<PreflightFinding>,
) {
  findings.push({ severity, code, message, ...extra });
}

function validateCnes(findings: PreflightFinding[], cnes: string) {
  if (!cnes) {
    push(findings, 'BLOCKER', 'CNES_MISSING', 'CNES da unidade ausente no header LEDI.', {
      field: 'headerTransport.cnes',
      hint: 'Finalize o atendimento com unidade válida (cadastro Facility.cnes).',
      moneyImpact: 'Produção sem CNES é rejeitada / não faturável.',
    });
    return;
  }
  if (!/^\d{7}$/.test(cnes)) {
    push(findings, 'MONEY_RISK', 'CNES_FORMAT', `CNES "${cnes}" não tem 7 dígitos.`, {
      field: 'headerTransport.cnes',
      moneyImpact: 'Risco de rejeição no SIA/SISAB e perda da competência.',
    });
  }
}

function validatePatientIds(findings: PreflightFinding[], child: Record<string, unknown>) {
  const cpf = str(child.cpfCidadao || child.cpf);
  const cns = str(child.cns);
  if (!cpf && !cns) {
    push(
      findings,
      'BLOCKER',
      'PATIENT_ID_MISSING',
      'Paciente sem CPF e sem CNS na ficha — identificação obrigatória para produção.',
      {
        field: 'cpf/cns',
        hint: 'Complete o cadastro do paciente antes de reenviar.',
        moneyImpact: 'Ficha sem identificação tende a ser rejeitada → perda de produção.',
      },
    );
  }
  if (cpf && !/^\d{11}$/.test(cpf)) {
    push(findings, 'MONEY_RISK', 'CPF_FORMAT', 'CPF não tem 11 dígitos.', {
      field: 'cpf',
      moneyImpact: 'Risco de rejeição na competência.',
    });
  }
  if (cns && (cns.length < 15 || cns.length > 16 || !/^\d+$/.test(cns))) {
    push(findings, 'MONEY_RISK', 'CNS_FORMAT', 'CNS inválido (espere 15–16 dígitos).', {
      field: 'cns',
      moneyImpact: 'Risco de rejeição na competência.',
    });
  }
}

function validateLotacao(findings: PreflightFinding[], header: Record<string, unknown>, kind: string) {
  const lotacao = asRecord(header.lotacaoFormPrincipal) || {};
  const cnsProf = str(
    header.profissionalCNS ||
      header.cnsProfissional ||
      header.cnesProfissional ||
      lotacao.profissionalCNS,
  );
  const cbo = str(header.cboCodigo_2002 || header.cbo || lotacao.cboCodigo_2002);
  const ine = str(header.ine || lotacao.ine);

  if (!cnsProf) {
    push(
      findings,
      'MONEY_RISK',
      'PROF_CNS_MISSING',
      'CNS do profissional ausente no header (lotação incompleta).',
      {
        field: 'headerTransport.profissionalCNS',
        hint: 'Cadastre CNS no profissional e/ou vincule lotação em /lotacoes.',
        moneyImpact: 'Produção sem profissional válido pode ser glosada.',
      },
    );
  }
  if (!cbo) {
    push(
      findings,
      kind === 'individual_encounter' || kind === 'vaccination' ? 'MONEY_RISK' : 'QUALITY_WARN',
      'CBO_MISSING',
      'CBO 2002 ausente no header — LEDI exige lotação (CNS+CBO+CNES+INE).',
      {
        field: 'headerTransport.cboCodigo_2002',
        hint: 'Crie lotação ativa do profissional na unidade (/lotacoes).',
        moneyImpact: 'Sem CBO o BPA/LEDI perde vínculo ocupacional → risco de glosa.',
      },
    );
  } else if (!/^\d{4,6}$/.test(cbo)) {
    push(findings, 'MONEY_RISK', 'CBO_FORMAT', `CBO "${cbo}" inválido.`, {
      field: 'cboCodigo_2002',
      moneyImpact: 'CBO inválido → rejeição.',
    });
  }
  if (!ine && (kind === 'individual_encounter' || kind === 'vaccination')) {
    push(
      findings,
      'QUALITY_WARN',
      'INE_MISSING',
      'INE da equipe ausente (comum em APS; recomendado no header LEDI).',
      {
        field: 'headerTransport.ine',
        hint: 'Vincule equipe com INE ao atendimento ou à lotação.',
      },
    );
  }
  const ibge = str(header.codigoIbgeMunicipio);
  if (!ibge) {
    push(
      findings,
      'MONEY_RISK',
      'IBGE_MISSING',
      'Código IBGE do município ausente no header LEDI.',
      {
        field: 'headerTransport.codigoIbgeMunicipio',
        hint: 'Cadastre IBGE (7 dígitos) na unidade em /unidades ou defina SIGS_IBGE_MUNICIPIO.',
        moneyImpact: 'Fichas sem IBGE tendem a rejeição no envio SISAB/LEDI.',
      },
    );
  } else if (!/^\d{7}$/.test(ibge)) {
    push(findings, 'MONEY_RISK', 'IBGE_FORMAT', `IBGE "${ibge}" inválido (espere 7 dígitos).`, {
      field: 'codigoIbgeMunicipio',
      moneyImpact: 'IBGE inválido → rejeição.',
    });
  }
}

function validateIndividual(findings: PreflightFinding[], p: Record<string, unknown>, child: Record<string, unknown>) {
  const list = p.atendimentosIndividuais;
  if (!Array.isArray(list) || !list.length) {
    push(findings, 'BLOCKER', 'AI_CHILD_MISSING', 'Ficha individual sem atendimentosIndividuais[].', {
      field: 'atendimentosIndividuais',
      moneyImpact: 'Lote vazio não gera produção.',
    });
    return;
  }
  const condutas = child.condutas;
  if (!Array.isArray(condutas) || !condutas.length) {
    push(findings, 'BLOCKER', 'OUTCOMES_MISSING', 'Conduta/desfecho ausente (obrigatório no LEDI AI).', {
      field: 'condutas',
      hint: 'Reabra o atendimento e finalize com ao menos um desfecho.',
      moneyImpact: 'Sem conduta a ficha é inválida → perda total do atendimento na competência.',
    });
  }
  const problem = asRecord(child.problemaCondicaoAvaliada);
  const ciaps = (problem?.ciaps as unknown[]) || (child.ciap2MotivoConsulta as unknown[]) || [];
  const cids = (problem?.cid10 as unknown[]) || [];
  if ((!Array.isArray(ciaps) || !ciaps.length) && (!Array.isArray(cids) || !cids.length)) {
    push(
      findings,
      'MONEY_RISK',
      'CIAP_CID_MISSING',
      'Sem CIAP e sem CID — produção frágil para indicadores/financiamento APS.',
      {
        field: 'problemaCondicaoAvaliada',
        moneyImpact: 'Pode reduzir qualidade da produção e gerar questionamentos na competência.',
      },
    );
  }
  if (!str(child.turno) && child.turno !== 0) {
    push(findings, 'QUALITY_WARN', 'SHIFT_MISSING', 'Turno ausente na ficha.', { field: 'turno' });
  }
  if (!str(child.localDeAtendimento || child.localAtendimento) && child.localDeAtendimento !== 0) {
    push(findings, 'QUALITY_WARN', 'CARE_LOCATION_MISSING', 'Local de atendimento ausente.', {
      field: 'localDeAtendimento',
    });
  }
  // ids LEDI ainda como strings amigáveis
  if (Array.isArray(condutas) && condutas.some((c) => typeof c === 'string' && /[A-Za-z_]/.test(c))) {
    push(
      findings,
      'QUALITY_WARN',
      'LEDI_ENUM_STRING',
      'Condutas ainda em texto (ALTA/…) — LEDI oficial espera ids numéricos de enum.',
      {
        field: 'condutas',
        hint: 'Finalize de novo o atendimento (mapper v2 emite ids). Catálogo: GET /v1/ledi/enums.',
      },
    );
  }
}

function validateVaccination(findings: PreflightFinding[], p: Record<string, unknown>, child: Record<string, unknown>) {
  const list = p.vacinacoesIndividuais;
  if (!Array.isArray(list) || !list.length) {
    push(findings, 'BLOCKER', 'VAC_CHILD_MISSING', 'Ficha de vacinação sem vacinacoesIndividuais[].', {
      moneyImpact: 'Lote vazio não gera produção.',
    });
    return;
  }
  const vacinas = child.vacinas;
  if (!Array.isArray(vacinas) || !vacinas.length) {
    push(findings, 'BLOCKER', 'VAC_ROWS_MISSING', 'Nenhuma dose/aplicação na ficha.', {
      field: 'vacinas',
      moneyImpact: 'Sem doses → perda de produção vacinal.',
    });
    return;
  }
  for (const [i, raw] of vacinas.entries()) {
    const row = asRecord(raw) || {};
    if (!str(row.imunobiologico)) {
      push(findings, 'BLOCKER', 'VAC_IMUNO_MISSING', `Dose #${i + 1}: imunobiológico ausente.`, {
        moneyImpact: 'Dose inválida não conta na competência.',
      });
    }
    if (!str(row.lote)) {
      push(findings, 'MONEY_RISK', 'VAC_LOT_MISSING', `Dose #${i + 1}: lote ausente.`, {
        moneyImpact: 'Pode gerar rejeição / não contabilização.',
      });
    }
    if (str(row.estrategiaVacinacao).toUpperCase() === 'ESPECIAL' || str(row.estrategiaVacinacao) === '4') {
      if (!str(row.cboPrescritorCodigo2002) || !str(row.cid10MotivoIndicacao)) {
        push(
          findings,
          'BLOCKER',
          'VAC_ESPECIAL_RULE',
          `Dose #${i + 1}: estratégia Especial exige CBO prescritor + CID.`,
          {
            moneyImpact: 'Regra LEDI — ficha rejeitada se enviar assim.',
          },
        );
      }
    }
  }
}

function validateDental(findings: PreflightFinding[], child: Record<string, unknown>) {
  const procs = child.procedimentosRealizados || child.procedimentos;
  if (!Array.isArray(procs) || !procs.length) {
    push(findings, 'MONEY_RISK', 'DENTAL_PROC_EMPTY', 'Odonto sem procedimentos listados.', {
      moneyImpact: 'BPA stub ainda emite código padrão, mas espelho clínico/LEDI fica incompleto.',
    });
  }
  const condutas = child.tiposEncamOdonto || child.condutas;
  if (!Array.isArray(condutas) || !condutas.length) {
    push(findings, 'BLOCKER', 'DENTAL_OUTCOMES', 'Odonto sem condutas/desfechos.', {
      moneyImpact: 'Finalização incompleta → risco de não contabilizar.',
    });
  }
  const vigil = child.tiposVigilanciaSaudeBucal;
  if (!Array.isArray(vigil) || !vigil.length) {
    push(
      findings,
      'BLOCKER',
      'DENTAL_VIGILANCIA',
      'Odonto sem tiposVigilanciaSaudeBucal (FAO#10 / RF-12.7).',
      {
        moneyImpact: 'Ficha incompleta → rejeição Siaps/RNDS.',
        hint: 'Finalize com vigilanciaSaudeBucal[] ou valide em POST /v1/dental/ledi/validate-xml.',
      },
    );
  }
  const problemas = child.problemasCondicoes || child.problemaCondicao;
  if (!Array.isArray(problemas) || !problemas.length) {
    push(findings, 'BLOCKER', 'DENTAL_PROBLEMAS', 'Odonto sem problemasCondicoes (CIAP/CID).', {
      moneyImpact: 'Granularidade clínica ausente → risco Siaps/RNDS.',
    });
  }
  if (child.tipoAtendimento == null) {
    push(findings, 'MONEY_RISK', 'DENTAL_TIPO_ATEND', 'tipoAtendimento ausente (2/4/5/6).', {
      field: 'tipoAtendimento',
    });
  }
}

function validateHomeCare(findings: PreflightFinding[], child: Record<string, unknown>) {
  const modalidade = child.atencaoDomiciliarModalidade ?? child.modalidade ?? child.careType;
  if (modalidade == null || modalidade === '') {
    push(findings, 'MONEY_RISK', 'AD_MODALITY_MISSING', 'Modalidade AD1/AD2/AD3 ausente.', {
      moneyImpact: 'Classificação AD incorreta afeta produção.',
    });
  }
}

function validateCollective(findings: PreflightFinding[], child: Record<string, unknown>, p: Record<string, unknown>) {
  const n = Number(child.numParticipantes || p.participantCount || 0);
  if (!Number.isFinite(n) || n < 1) {
    push(findings, 'BLOCKER', 'COLLECTIVE_QTY', 'Atividade coletiva com participantes < 1.', {
      field: 'numParticipantes',
      moneyImpact: 'Quantidade BPA = 0 → perda total da produção coletiva.',
    });
  }
}

export function validateBatch(
  batch: BatchLike,
  opts?: { sigtapKnown?: Record<string, boolean> },
): BatchPreflight {
  const findings: PreflightFinding[] = [];
  const createdAt =
    typeof batch.createdAt === 'string' ? batch.createdAt : batch.createdAt.toISOString();
  const competencia = competenciaFrom(batch.createdAt);
  const kindMap = KIND_PROC[batch.kind];

  if (!kindMap) {
    push(findings, 'BLOCKER', 'KIND_UNKNOWN', `Tipo de lote desconhecido: ${batch.kind}.`, {
      moneyImpact: 'Não entra no BPA stub nem em mapa LEDI conhecido.',
    });
  }

  if (batch.status !== 'ready' && batch.status !== 'sent') {
    push(findings, 'QUALITY_WARN', 'STATUS_NOT_READY', `Status atual: ${batch.status}.`, {
      hint: 'Somente lotes ready entram no envio padrão.',
    });
  }

  const p = payloadOf(batch);
  if (!p) {
    push(findings, 'BLOCKER', 'PAYLOAD_JSON_INVALID', 'payloadJson inválido (JSON quebrado).', {
      moneyImpact: 'Lote inutilizável — produção perdida até regenerar.',
    });
  } else {
    if (!str(p.uuidFicha)) {
      push(findings, 'MONEY_RISK', 'UUID_FICHA_MISSING', 'uuidFicha ausente — rastreio LEDI prejudicado.', {
        field: 'uuidFicha',
      });
    }
    const header = headerOf(p);
    const child = childOf(batch.kind, p);
    validateCnes(findings, str(header.cnes || p.facilityCnes || p.cnes));
    validateLotacao(findings, header, batch.kind);
    if (batch.kind !== 'collective_activity') {
      validatePatientIds(findings, child);
    }

    if (batch.kind === 'individual_encounter') validateIndividual(findings, p, child);
    if (batch.kind === 'vaccination') validateVaccination(findings, p, child);
    if (batch.kind === 'dental_encounter') validateDental(findings, child);
    if (batch.kind === 'home_care') validateHomeCare(findings, child);
    if (batch.kind === 'collective_activity') validateCollective(findings, child, p);

    if (kindMap && opts?.sigtapKnown) {
      const known = opts.sigtapKnown[kindMap.code];
      if (known === false) {
        push(
          findings,
          'MONEY_RISK',
          'SIGTAP_UNKNOWN',
          `Código SIGTAP ${kindMap.code} não está no catálogo local.`,
          {
            field: 'procedimento',
            hint: 'Importe TB_PROCEDIMENTO ou JSON stub em /sigtap.',
            moneyImpact: 'Export BPA com código desconhecido → risco de glosa / não pagamento.',
          },
        );
      }
    }
  }

  const blockers = findings.filter((f) => f.severity === 'BLOCKER').length;
  const moneyRisks = findings.filter((f) => f.severity === 'MONEY_RISK').length;
  const qualityWarns = findings.filter((f) => f.severity === 'QUALITY_WARN').length;

  return {
    batchId: batch.id,
    kind: batch.kind,
    status: batch.status,
    createdAt,
    competencia,
    procedureCode: kindMap?.code,
    procedureLabel: kindMap?.label,
    findings,
    blockers,
    moneyRisks,
    qualityWarns,
    canSendAlone: blockers === 0 && batch.status === 'ready',
  };
}

export function buildPreflightReport(
  batches: BatchLike[],
  opts?: {
    competencia?: string;
    statuses?: string[];
    sigtapKnown?: Record<string, boolean>;
    rfIds?: string[];
  },
): PreflightReport {
  const statuses = opts?.statuses?.length ? opts.statuses : ['ready'];
  let filtered = batches.filter((b) => statuses.includes(b.status));
  if (opts?.competencia) {
    filtered = filtered.filter((b) => competenciaFrom(b.createdAt) === opts.competencia);
  }

  const batchReports = filtered.map((b) => validateBatch(b, { sigtapKnown: opts?.sigtapKnown }));
  const blockers = batchReports.reduce((s, b) => s + b.blockers, 0);
  const moneyRisks = batchReports.reduce((s, b) => s + b.moneyRisks, 0);
  const qualityWarns = batchReports.reduce((s, b) => s + b.qualityWarns, 0);

  const allFindings = batchReports.flatMap((b) =>
    b.findings.map((f) => ({ ...f, batchId: b.batchId, kind: b.kind })),
  );

  const missingStructures = [
    ...new Set(
      allFindings
        .filter((f) => f.severity === 'BLOCKER' || f.code.includes('MISSING'))
        .map((f) => f.message),
    ),
  ].slice(0, 30);

  const sendBlockers = [
    ...new Set(allFindings.filter((f) => f.severity === 'BLOCKER').map((f) => f.message)),
  ];

  const productionLossRisks = [
    ...new Set(
      allFindings
        .filter((f) => f.moneyImpact && /perda|não gera|vazio|rejeit/i.test(f.moneyImpact + f.message))
        .map((f) => f.moneyImpact || f.message),
    ),
  ];

  const moneyLossRisks = [
    ...new Set(
      allFindings
        .filter((f) => f.severity === 'MONEY_RISK')
        .map((f) => f.moneyImpact || f.message),
    ),
  ];

  const unknownCodes = [
    ...new Set(
      batchReports
        .filter((b) => b.findings.some((f) => f.code === 'SIGTAP_UNKNOWN'))
        .map((b) => b.procedureCode!)
        .filter(Boolean),
    ),
  ];

  const knownCount = batchReports.filter(
    (b) => b.procedureCode && opts?.sigtapKnown?.[b.procedureCode] === true,
  ).length;

  const canSend = batchReports.length > 0 && blockers === 0;

  const checklist = [
    {
      id: 'has_batches',
      ok: batchReports.length > 0,
      label: 'Existem lotes prontos na competência/filtro',
    },
    {
      id: 'no_blockers',
      ok: blockers === 0,
      label: 'Nenhum bloqueio estrutural (LEDI/identificação/condutas)',
    },
    {
      id: 'cnes_ok',
      ok: !allFindings.some((f) => f.code === 'CNES_MISSING' || f.code === 'CNES_FORMAT'),
      label: 'CNES presente e com 7 dígitos',
    },
    {
      id: 'patient_id_ok',
      ok: !allFindings.some((f) => f.code === 'PATIENT_ID_MISSING'),
      label: 'Pacientes identificados (CPF ou CNS)',
    },
    {
      id: 'lotacao_cbo',
      ok: !allFindings.some((f) => f.code === 'CBO_MISSING'),
      label: 'CBO de lotação presente no header',
    },
    {
      id: 'ibge_ok',
      ok: !allFindings.some((f) => f.code === 'IBGE_MISSING' || f.code === 'IBGE_FORMAT'),
      label: 'IBGE município (7 dígitos) no header',
    },
    {
      id: 'sigtap_known',
      ok: unknownCodes.length === 0,
      label: 'Códigos SIGTAP do BPA conhecidos no catálogo local',
    },
    {
      id: 'money_risks',
      ok: moneyRisks === 0,
      label: 'Sem riscos financeiros (glosa / não pagamento)',
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    competencia: opts?.competencia,
    statusFilter: statuses,
    totals: {
      batches: batchReports.length,
      ready: batchReports.filter((b) => b.status === 'ready').length,
      blockers,
      moneyRisks,
      qualityWarns,
      canSend,
    },
    summary: {
      missingStructures,
      sendBlockers,
      productionLossRisks,
      moneyLossRisks,
    },
    batches: batchReports,
    sigtap: {
      known: knownCount,
      unknown: unknownCodes.length,
      unknownCodes,
    },
    checklist,
    rfIds: opts?.rfIds || ['RF-10.20', 'RF-10.4', 'RF-9.2', 'RF-9.5'],
  };
}
