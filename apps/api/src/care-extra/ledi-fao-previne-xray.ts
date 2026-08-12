/**
 * Raio-x Previne Brasil (ESB B1–B6) + qualidade sobre ficha FAO.
 * Não substitui o validador LEDI/Siaps — complementa com oportunidades de
 * faturamento/indicador antes do envio final.
 *
 * Spec: docs/conhecimento/14-indicadores-aps-previne-brasil.md
 *       docs/conhecimento/15-faturamento-indicadores-campos-obrigatorios.md
 */

import type { FaoFinding } from './ledi-fao.validator';

export type PrevineIndicatorId = 'B1' | 'B2' | 'B3' | 'B5' | 'B6' | 'QUALITY';

export type PrevineGap = {
  code: string;
  indicator: PrevineIndicatorId;
  severity: 'MONEY_RISK' | 'QUALITY_WARN' | 'INFO';
  message: string;
  hint?: string;
  repair?: string;
};

export type PrevineIndicatorSlice = {
  id: PrevineIndicatorId;
  title: string;
  status: 'ok' | 'gap' | 'partial' | 'n/a';
  note?: string;
  gaps: PrevineGap[];
};

export type PrevineXraySignals = {
  procCodes: string[];
  hasFirstConsultaProgramada: boolean;
  hasTratamentoConcluido: boolean;
  hasTiposConsulta: boolean;
  preventiveCount: number;
  restorativeCount: number;
  artCount: number;
  exodontiaCount: number;
  individualProcCount: number;
  vigilanciaCodes: number[];
  vigilanciaOnly99: boolean;
  inePresent: boolean;
  problemasPresent: boolean;
  cboOdontoOk: boolean;
  cbo: string;
};

export type PrevineXray = {
  channel: 'PREVINE_ESB_B1_B6';
  signals: PrevineXraySignals;
  indicators: PrevineIndicatorSlice[];
  gaps: PrevineGap[];
  summary: {
    moneyRisks: number;
    qualityWarns: number;
    infos: number;
    gapCount: number;
  };
  findings: FaoFinding[];
};

/** Normaliza SIGTAP (remove pontuação). */
export function normSigtap(code: unknown): string {
  return String(code ?? '').replace(/\D/g, '');
}

const FIRST_CONSULTA = new Set(['0301010153']); // 03.01.01.015-3
const ART = new Set(['0307010074']); // 03.07.01.007-4
const EXODONTIA = new Set(['0414020138', '0414020146']); // 04.14.02.013-8 / 014-6

const PREVENTIVE = new Set([
  '0101020058', // cariostático
  '0101020066', // selante
  '0101020074', // flúor
  '0101020082', // evidenciação placa
  '0101020104', // orientação higiene bucal
  '0101020120', // orientação próteses
  '0307030040', // profilaxia
]);

const RESTORATIVE = new Set([
  '0307010031',
  '0307010082',
  '0307010104',
  '0307010112',
  '0307010120',
  '0307010074', // ART entra no denom B6
]);

/** B5 denominador — preventivos + demais individuais do guia (subset crítico). */
const B5_DENOM = new Set([
  ...PREVENTIVE,
  '0101020090', // selamento provisório
  ...EXODONTIA,
  '0307010015', // capeamento
  '0307010031',
  '0307010082',
  '0307010104',
  '0307010112',
  '0307010120',
  '0307010147',
  '0307010155',
  '0307020010',
  '0307020029',
  '0307020070',
  '0307030024',
  '0307030059',
  '0307030067',
  '0307030075',
  '0307030083',
  '0307050017',
  '0307010074',
]);

const CBO_ESB = new Set(['223208', '223293', '223272', '223205', '223210']); // família 2232*
const CONDUTA_TRAT_CONCLUIDO = 15;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asArray(v: unknown): unknown[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function collectSignals(master: Record<string, unknown>): PrevineXraySignals {
  const header = asRecord(master.headerTransport) || {};
  const lotacao = asRecord(header.lotacaoFormPrincipal) || {};
  const cbo = String(header.cboCodigo_2002 ?? lotacao.cboCodigo_2002 ?? '').replace(/\D/g, '');
  const ine = String(header.ine ?? lotacao.ine ?? '').trim();

  const children = asArray(master.atendimentosOdontologicos).map((c) => asRecord(c) || {});
  const procCodes: string[] = [];
  const vigilanciaCodes: number[] = [];
  let hasTiposConsulta = false;
  let hasTratamentoConcluido = false;
  let problemasPresent = false;

  for (const child of children) {
    if (asArray(child.problemasCondicoes).length) problemasPresent = true;
    const consultas = asArray(child.tiposConsultaOdonto);
    if (consultas.length) hasTiposConsulta = true;
    const encams = asArray(child.tiposEncamOdonto).map((x) => Number(x));
    if (encams.includes(CONDUTA_TRAT_CONCLUIDO)) hasTratamentoConcluido = true;
    for (const v of asArray(child.tiposVigilanciaSaudeBucal)) {
      const n = Number(v);
      if (Number.isFinite(n)) vigilanciaCodes.push(n);
    }
    for (const p of asArray(child.procedimentosRealizados)) {
      const r = asRecord(p) || {};
      const code = normSigtap(r.coMsProcedimento ?? r.codigo ?? r.code);
      if (code) procCodes.push(code);
    }
  }

  const preventiveCount = procCodes.filter((c) => PREVENTIVE.has(c)).length;
  const artCount = procCodes.filter((c) => ART.has(c)).length;
  const exodontiaCount = procCodes.filter((c) => EXODONTIA.has(c)).length;
  const restorativeCount = procCodes.filter((c) => RESTORATIVE.has(c)).length;
  const individualProcCount = procCodes.filter((c) => B5_DENOM.has(c) || PREVENTIVE.has(c) || EXODONTIA.has(c) || RESTORATIVE.has(c)).length;

  const vigUnique = [...new Set(vigilanciaCodes)];
  const vigilanciaOnly99 = vigUnique.length > 0 && vigUnique.every((v) => v === 99);

  const cboOdontoOk =
    CBO_ESB.has(cbo) || (cbo.startsWith('2232') && cbo.length >= 6) || cbo.startsWith('3224');

  return {
    procCodes: [...new Set(procCodes)],
    hasFirstConsultaProgramada: procCodes.some((c) => FIRST_CONSULTA.has(c)),
    hasTratamentoConcluido,
    hasTiposConsulta,
    preventiveCount,
    restorativeCount,
    artCount,
    exodontiaCount,
    individualProcCount: individualProcCount || procCodes.length,
    vigilanciaCodes: vigUnique,
    vigilanciaOnly99,
    inePresent: !!ine,
    problemasPresent,
    cboOdontoOk,
    cbo,
  };
}

function gap(
  indicator: PrevineIndicatorId,
  severity: PrevineGap['severity'],
  code: string,
  message: string,
  extra?: Partial<PrevineGap>,
): PrevineGap {
  return { indicator, severity, code, message, ...extra };
}

/** Analisa master FAO e devolve raio-x Previne ESB + findings espelhados. */
export function analyzePrevineEsbXray(master: Record<string, unknown>): PrevineXray {
  const signals = collectSignals(master);
  const gaps: PrevineGap[] = [];

  // —— QUALIDADE / vínculo ——
  if (!signals.inePresent) {
    gaps.push(
      gap(
        'QUALITY',
        'MONEY_RISK',
        'PREVINE_INE_MISSING',
        'INE ausente — denominadores B1/B4 e vínculo de equipe ficam inconsistentes.',
        {
          repair: 'Preencha INE da eSB no envelope/lotação antes do envio.',
          hint: 'Sem INE o Siaps até pode aceitar, mas o Previne não amarra bem a equipe.',
        },
      ),
    );
  }
  if (!signals.cboOdontoOk) {
    gaps.push(
      gap(
        'QUALITY',
        'MONEY_RISK',
        'PREVINE_CBO_NOT_ESB',
        `CBO ${signals.cbo || '(vazio)'} fora da família elegível ESB (2232*/3224*).`,
        { repair: 'Use CBO de cirurgião-dentista ESF/clínico/saúde coletiva ou TSB.' },
      ),
    );
  }
  if (!signals.problemasPresent) {
    gaps.push(
      gap(
        'QUALITY',
        'MONEY_RISK',
        'PREVINE_PROBLEMAS_MISSING',
        'Sem problemasCondicoes (CIAP/CID) — qualidade clínica e aceite LEDI comprometidos.',
        { repair: 'Inclua ao menos um CIAP ou CID10 no atendimento.' },
      ),
    );
  }
  if (signals.vigilanciaOnly99) {
    gaps.push(
      gap(
        'QUALITY',
        'QUALITY_WARN',
        'PREVINE_VIGILANCIA_99',
        'Vigilância saúde bucal só com código 99 (“outro”) — mascara produção/vigilância útil.',
        { repair: 'Registrar vigilância específica quando houver (cárie, doença periodontal, etc.).' },
      ),
    );
  }

  // —— B1 ——
  if (!signals.hasFirstConsultaProgramada) {
    gaps.push(
      gap(
        'B1',
        'MONEY_RISK',
        'PREVINE_B1_NO_FIRST_CONSULTA',
        'Sem procedimento 03.01.01.015-3 (1ª consulta odontológica programada) — numerador B1 não sobe.',
        {
          repair: 'Se for 1ª consulta programada, inclua SIGTAP 0301010153 no XML.',
          hint: 'B1 = pessoas com 1ª consulta programada / vinculadas à eSF de referência.',
        },
      ),
    );
  }

  // —— B2 ——
  if (signals.hasFirstConsultaProgramada && !signals.hasTratamentoConcluido) {
    gaps.push(
      gap(
        'B2',
        'MONEY_RISK',
        'PREVINE_B2_NO_CONCLUSAO',
        'Há 1ª consulta programada, mas sem conduta 15 (tratamento concluído) — B2 (resolutividade) não conta.',
        {
          repair: 'Ao concluir o plano terapêutico, registre tiposEncamOdonto=15 com tiposConsultaOdonto 1 ou 2.',
        },
      ),
    );
  } else if (!signals.hasFirstConsultaProgramada && !signals.hasTratamentoConcluido) {
    gaps.push(
      gap(
        'B2',
        'INFO',
        'PREVINE_B2_NO_PAIR',
        'Sem par 1ª consulta + conclusão — B2 depende dos dois eventos na janela.',
        { hint: 'B2 = concluídos / 1ªs consultas programadas.' },
      ),
    );
  }

  // —— B3 ——
  if (signals.individualProcCount > 0) {
    const rate =
      signals.exodontiaCount === 0
        ? 0
        : (signals.exodontiaCount / Math.max(signals.individualProcCount, 1)) * 100;
    if (signals.exodontiaCount === 0 && signals.individualProcCount >= 3) {
      gaps.push(
        gap(
          'B3',
          'INFO',
          'PREVINE_B3_NO_EXODONTIA',
          'Sem exodontia neste atendimento — B3 (taxa) usa o mix do período; ok se o perfil for preventivo.',
        ),
      );
    } else if (rate >= 14) {
      gaps.push(
        gap(
          'B3',
          'MONEY_RISK',
          'PREVINE_B3_HIGH_EXODONTIA',
          `Proporção local de exodontia ≈ ${rate.toFixed(0)}% dos procedimentos observados — faixa Regular do B3 (≥14).`,
          {
            repair: 'Revisar se preventivos/curativos estão sendo registrados; alta exodontia piora B3.',
          },
        ),
      );
    } else if (rate > 0 && rate < 3) {
      gaps.push(
        gap(
          'B3',
          'QUALITY_WARN',
          'PREVINE_B3_LOW_EXODONTIA_SHARE',
          `Proporção local de exodontia ≈ ${rate.toFixed(0)}% — abaixo do Ótimo B3 (≥3 e <10) neste recorte.`,
        ),
      );
    }
  }

  // —— B5 ——
  if (signals.individualProcCount > 0) {
    const prevRate = (signals.preventiveCount / Math.max(signals.individualProcCount, 1)) * 100;
    if (signals.preventiveCount === 0) {
      gaps.push(
        gap(
          'B5',
          'MONEY_RISK',
          'PREVINE_B5_NO_PREVENTIVE',
          'Nenhum procedimento preventivo individual (flúor, selante, profilaxia, orientação…) — B5 tende a cair.',
          {
            repair: 'Registrar preventivos elegíveis (ex. 0101020074, 0101020104, 0307030040).',
          },
        ),
      );
    } else if (prevRate < 40) {
      gaps.push(
        gap(
          'B5',
          'MONEY_RISK',
          'PREVINE_B5_LOW_PREVENTIVE',
          `Preventivos ≈ ${prevRate.toFixed(0)}% neste atendimento — abaixo do Suficiente B5 (≥40).`,
          { repair: 'Aumentar registro de preventivos vs só curativos/exodontia.' },
        ),
      );
    } else if (prevRate > 85) {
      gaps.push(
        gap(
          'B5',
          'QUALITY_WARN',
          'PREVINE_B5_HIGH_PREVENTIVE',
          `Preventivos ≈ ${prevRate.toFixed(0)}% — acima de 85% também é Regular no B5 (ambas as pontas).`,
        ),
      );
    }
  } else {
    gaps.push(
      gap(
        'B5',
        'QUALITY_WARN',
        'PREVINE_B5_NO_PROCS',
        'Sem procedimentos individuais reconhecidos para estimar B5.',
        { repair: 'Confira coMsProcedimento SIGTAP no XML.' },
      ),
    );
  }

  // —— B6 ——
  if (signals.restorativeCount > 0 && signals.artCount === 0) {
    gaps.push(
      gap(
        'B6',
        'MONEY_RISK',
        'PREVINE_B6_NO_ART',
        'Há restaurações, mas nenhum ART (03.07.01.007-4) — numerador B6 fica zerado neste atendimento.',
        {
          repair: 'Quando aplicável, registrar TRA/ART 0307010074.',
          hint: 'B6 = ART / (ART + restaurações).',
        },
      ),
    );
  } else if (signals.restorativeCount === 0 && signals.artCount === 0) {
    gaps.push(
      gap(
        'B6',
        'INFO',
        'PREVINE_B6_NO_RESTORATIVE',
        'Sem procedimentos restauradores neste XML — B6 não se aplica a este atendimento.',
      ),
    );
  }

  // —— B4 nota ——
  gaps.push(
    gap(
      'QUALITY',
      'INFO',
      'PREVINE_B4_NOT_IN_FAO',
      'B4 (escovação supervisionada) usa ação coletiva 01.01.02.003-1 — não entra na FAO individual.',
      { hint: 'Garantir registro em atividade coletiva / ficha correspondente.' },
    ),
  );

  const indicators: PrevineIndicatorSlice[] = [
    slice('B1', '1ª consulta programada', signals.hasFirstConsultaProgramada ? 'ok' : 'gap', gaps),
    slice(
      'B2',
      'Tratamento concluído',
      signals.hasTratamentoConcluido && signals.hasFirstConsultaProgramada
        ? 'ok'
        : signals.hasFirstConsultaProgramada || signals.hasTratamentoConcluido
          ? 'partial'
          : 'gap',
      gaps,
    ),
    slice('B3', 'Taxa de exodontia (recorte local)', 'partial', gaps, 'Estimativa neste XML; B3 é do período.'),
    slice(
      'B5',
      'Procedimentos preventivos (recorte local)',
      signals.preventiveCount > 0 ? 'partial' : 'gap',
      gaps,
    ),
    slice(
      'B6',
      'ART / restaurações (recorte local)',
      signals.artCount > 0 ? 'ok' : signals.restorativeCount > 0 ? 'gap' : 'n/a',
      gaps,
    ),
    slice('QUALITY', 'Qualidade / vínculo', signals.inePresent && signals.problemasPresent ? 'partial' : 'gap', gaps),
  ];

  const findings: FaoFinding[] = gaps.map((g) => ({
    severity: g.severity,
    code: g.code,
    message: g.message,
    hint: g.repair || g.hint,
    rndsImpact:
      g.severity === 'MONEY_RISK'
        ? `Previne ${g.indicator}: risco de perder ponto/financiamento se o padrão se repetir no período.`
        : undefined,
    field: `previne.${g.indicator}`,
    rule: 'CONASEMS-Previne-ESB',
  }));

  const moneyRisks = gaps.filter((g) => g.severity === 'MONEY_RISK').length;
  const qualityWarns = gaps.filter((g) => g.severity === 'QUALITY_WARN').length;
  const infos = gaps.filter((g) => g.severity === 'INFO').length;

  return {
    channel: 'PREVINE_ESB_B1_B6',
    signals,
    indicators,
    gaps,
    summary: { moneyRisks, qualityWarns, infos, gapCount: gaps.length },
    findings,
  };
}

function slice(
  id: PrevineIndicatorId,
  title: string,
  status: PrevineIndicatorSlice['status'],
  all: PrevineGap[],
  note?: string,
): PrevineIndicatorSlice {
  return {
    id,
    title,
    status,
    note,
    gaps: all.filter((g) => g.indicator === id),
  };
}

/** Agrega raio-x de vários itens de lote. */
export function aggregatePrevineXrays(
  items: Array<{ fileName: string; xray: PrevineXray }>,
): {
  files: number;
  codeCounts: Array<{ code: string; indicator: string; files: number; severity: string; sample: string }>;
  indicatorGaps: Array<{ id: string; filesWithGap: number; pct: number }>;
  signalRates: {
    withFirstConsulta: number;
    withConclusao: number;
    withPreventive: number;
    withArt: number;
    withIne: number;
    vigilancia99: number;
  };
} {
  const codeMap = new Map<string, { indicator: string; severity: string; files: number; sample: string }>();
  const indGap = new Map<string, number>();
  let withFirstConsulta = 0;
  let withConclusao = 0;
  let withPreventive = 0;
  let withArt = 0;
  let withIne = 0;
  let vigilancia99 = 0;

  for (const it of items) {
    const s = it.xray.signals;
    if (s.hasFirstConsultaProgramada) withFirstConsulta += 1;
    if (s.hasTratamentoConcluido) withConclusao += 1;
    if (s.preventiveCount > 0) withPreventive += 1;
    if (s.artCount > 0) withArt += 1;
    if (s.inePresent) withIne += 1;
    if (s.vigilanciaOnly99) vigilancia99 += 1;

    const seenInd = new Set<string>();
    for (const g of it.xray.gaps) {
      if (g.severity === 'INFO' && g.code === 'PREVINE_B4_NOT_IN_FAO') continue;
      const prev = codeMap.get(g.code);
      if (prev) prev.files += 1;
      else
        codeMap.set(g.code, {
          indicator: g.indicator,
          severity: g.severity,
          files: 1,
          sample: it.fileName,
        });
      if (g.severity !== 'INFO') seenInd.add(g.indicator);
    }
    for (const id of seenInd) indGap.set(id, (indGap.get(id) || 0) + 1);
  }

  const n = items.length || 1;
  return {
    files: items.length,
    codeCounts: [...codeMap.entries()]
      .map(([code, v]) => ({ code, ...v }))
      .sort((a, b) => b.files - a.files),
    indicatorGaps: [...indGap.entries()]
      .map(([id, filesWithGap]) => ({
        id,
        filesWithGap,
        pct: Math.round((filesWithGap / n) * 1000) / 10,
      }))
      .sort((a, b) => b.filesWithGap - a.filesWithGap),
    signalRates: {
      withFirstConsulta,
      withConclusao,
      withPreventive,
      withArt,
      withIne,
      vigilancia99,
    },
  };
}
