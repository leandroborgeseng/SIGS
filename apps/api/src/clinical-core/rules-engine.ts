import { validateFaoXml, type FaoFinding } from '../care-extra/ledi-fao.validator';
import { validateFaiXml } from '../care-extra/ledi-fai.validator';
import { validateProcXml } from '../care-extra/ledi-proc.validator';
import type { PrevineXray } from '../care-extra/ledi-fao-previne-xray';
import type { RulesEngineResult, RulesFinding, SigsComposition } from './sigs-fhir.types';
import { lediXmlToComposition } from './adapters/ledi-xml.adapter';

export type LediRulePack = 'FAO' | 'FAI' | 'PROCEDIMENTOS';

export type RulesEngineInput = {
  xml?: string;
  composition?: SigsComposition;
  /** Se omitido, usa composition.fichaTipo / detecção do XML */
  rulePack?: LediRulePack;
  /** Anexa Previne em `previneXray` (não mistura em findings LEDI) */
  includePrevine?: boolean;
};

export type RulesEngineOutput = RulesEngineResult & {
  previneXray?: PrevineXray;
  siapsReady: boolean;
  previneReady: boolean;
  readyForFinalSend: boolean;
  rulePack: LediRulePack | 'UNKNOWN';
};

function mapFindings(
  list: Array<{ code: string; severity: string; message: string; path?: string; hint?: string; field?: string; rule?: string }>,
): FaoFinding[] {
  return list.map((f) => ({
    code: f.code,
    severity: f.severity as FaoFinding['severity'],
    message: f.message,
    path: f.path,
    hint: f.hint,
    field: f.field,
    rule: f.rule,
  }));
}

function resolvePack(input: RulesEngineInput, composition: SigsComposition): LediRulePack | 'UNKNOWN' {
  if (input.rulePack) return input.rulePack;
  if (composition.fichaTipo === 'FAO' || composition.fichaTipo === 'FAI' || composition.fichaTipo === 'PROCEDIMENTOS') {
    return composition.fichaTipo;
  }
  return 'UNKNOWN';
}

/**
 * Motor único: normalize → validate (RulePack) → audit.
 * Findings LEDI ficam em `findings`; Previne em `previneXray` (paridade com o lote).
 */
export function runRulesEngine(input: RulesEngineInput): RulesEngineOutput {
  const audit: RulesEngineResult['audit'] = [];
  const xml = input.xml || input.composition?.sourceXml;
  if (!xml) {
    const composition = input.composition || {
      resourceType: 'Composition' as const,
      title: 'vazio',
      fichaTipo: 'UNKNOWN',
      encounters: [],
      sourceFormat: 'unknown' as const,
    };
    return {
      findings: [
        {
          code: 'RULES_NO_SOURCE',
          severity: 'BLOCKER',
          message: 'Motor sem XML/composition de origem.',
        },
      ],
      composition,
      repaired: false,
      audit: [{ action: 'validate', detail: { error: 'no_source' } }],
      siapsReady: false,
      previneReady: false,
      readyForFinalSend: false,
      rulePack: 'UNKNOWN',
    };
  }

  const composition = input.composition || lediXmlToComposition(xml);
  const rulePack = resolvePack(input, composition);
  audit.push({
    action: 'normalize',
    detail: {
      fichaTipo: composition.fichaTipo,
      rulePack,
      encounters: composition.encounters.length,
      uuidFicha: composition.uuidFicha,
    },
  });

  let findings: RulesFinding[] = [];
  let previneXray: PrevineXray | undefined;
  let siapsReady = false;
  let previneReady = true;

  if (rulePack === 'FAO') {
    const report = validateFaoXml(xml);
    findings = mapFindings(report.findings);
    siapsReady = report.siapsReady;
    previneReady = report.previneReady;
    if (input.includePrevine !== false) {
      previneXray = report.previneXray;
    }
  } else if (rulePack === 'FAI') {
    const report = validateFaiXml(xml);
    findings = mapFindings(report.findings);
    siapsReady = report.siapsReady;
    previneReady = report.previneReady;
  } else if (rulePack === 'PROCEDIMENTOS') {
    const report = validateProcXml(xml);
    findings = mapFindings(report.findings);
    siapsReady = report.siapsReady;
    previneReady = report.previneReady;
  } else {
    findings = [
      {
        code: 'WRONG_FICHA_TIPO',
        severity: 'BLOCKER',
        message: `Tipo ${composition.fichaTipo} sem RulePack neste motor.`,
      },
    ];
    siapsReady = false;
    previneReady = false;
  }

  audit.push({
    action: 'validate',
    detail: {
      rulePack,
      findingCount: findings.length,
      blockers: findings.filter((f) => f.severity === 'BLOCKER').length,
    },
  });

  return {
    findings,
    composition,
    indicators: previneXray as unknown as Record<string, unknown> | undefined,
    previneXray,
    repaired: false,
    audit,
    siapsReady,
    previneReady,
    readyForFinalSend: siapsReady && previneReady,
    rulePack,
  };
}
