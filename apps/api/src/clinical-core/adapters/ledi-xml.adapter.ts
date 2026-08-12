import { detectLediFichaTipo } from '../../care-extra/ledi-ficha-tipo';
import { extractFaoMasterFromXml, parseXml, type XmlNode } from '../../care-extra/ledi-fao-xml.parser';
import type {
  SigsComposition,
  SigsCondition,
  SigsEncounter,
  SigsIdentifier,
  SigsPatient,
  SigsProcedure,
} from '../sigs-fhir.types';

function text(node: XmlNode | undefined): string | undefined {
  if (!node) return undefined;
  if (node.text?.trim()) return node.text.trim();
  if (node.children.length === 1 && !node.children[0]!.children.length) {
    return node.children[0]!.text.trim() || undefined;
  }
  return undefined;
}

function child(node: XmlNode | undefined, name: string): XmlNode | undefined {
  return node?.children.find((c) => c.name === name);
}

function children(node: XmlNode | undefined, name: string): XmlNode[] {
  return node?.children.filter((c) => c.name === name) || [];
}

function epochToIso(ms?: string): string | undefined {
  if (!ms || !/^\d+$/.test(ms)) return undefined;
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return new Date(n).toISOString();
}

function epochToDate(ms?: string): string | undefined {
  const iso = epochToIso(ms);
  return iso ? iso.slice(0, 10) : undefined;
}

function sexFromLedi(raw?: string): SigsPatient['sex'] {
  if (raw === '0') return 'male';
  if (raw === '1') return 'female';
  return 'unknown';
}

function patientFromAtendimento(at: XmlNode): SigsPatient {
  const cpf = text(child(at, 'cpfCidadao'));
  const cns = text(child(at, 'cnsCidadao'));
  const identifiers: SigsIdentifier[] = [];
  if (cpf) identifiers.push({ system: 'cpf', value: cpf.replace(/\D/g, ''), use: 'official' });
  if (cns) identifiers.push({ system: 'cns', value: cns.replace(/\D/g, ''), use: 'official' });

  return {
    resourceType: 'Patient',
    identifiers,
    birthDate: epochToDate(text(child(at, 'dtNascimento'))),
    sex: sexFromLedi(text(child(at, 'sexo'))),
  };
}

function proceduresFrom(at: XmlNode): SigsProcedure[] {
  const blocks = children(at, 'procedimentosRealizados');
  const out: SigsProcedure[] = [];
  for (const b of blocks) {
    const code = text(child(b, 'coMsProcedimento'));
    if (!code) continue;
    const q = Number(text(child(b, 'quantidade')) || '1');
    out.push({
      resourceType: 'Procedure',
      code: code.replace(/\D/g, ''),
      quantity: Number.isFinite(q) && q > 0 ? q : 1,
    });
  }
  return out;
}

function conditionsFrom(at: XmlNode): SigsCondition[] {
  const blocks = children(at, 'problemasCondicoes');
  return blocks.map((b) => ({
    resourceType: 'Condition' as const,
    ciap: text(child(b, 'ciap')) || text(child(b, 'coCiap')),
    cid10: text(child(b, 'cid10')) || text(child(b, 'codCid10')),
  }));
}

function encounterFromAtendimento(
  at: XmlNode,
  meta: { fichaTipo?: string; uuidFicha?: string; cnes?: string; ine?: string; ibge?: string; cbo?: string; cnsProf?: string },
): SigsEncounter {
  const stRaw = text(child(at, 'stNaoPossuiCpf'));
  const gestRaw = text(child(at, 'gestante'));
  return {
    resourceType: 'Encounter',
    fichaTipo: meta.fichaTipo,
    uuidFicha: meta.uuidFicha,
    status: 'finished',
    periodStart: epochToIso(text(child(at, 'dataHoraInicialAtendimento'))),
    periodEnd: epochToIso(text(child(at, 'dataHoraFinalAtendimento'))),
    patient: patientFromAtendimento(at),
    practitionerCns: meta.cnsProf,
    cbo: meta.cbo,
    cnes: meta.cnes,
    ine: meta.ine,
    ibgeMunicipio: meta.ibge,
    localAtendimento: Number(text(child(at, 'localAtendimento')) || undefined) || undefined,
    turno: Number(text(child(at, 'turno')) || undefined) || undefined,
    tipoAtendimento: Number(text(child(at, 'tipoAtendimento')) || undefined) || undefined,
    gestante: gestRaw === 'true' ? true : gestRaw === 'false' ? false : undefined,
    stNaoPossuiCpf: stRaw === 'true' ? true : stRaw === 'false' ? false : undefined,
    justificativaNaoPossuiCpf: Number(text(child(at, 'justificativaNaoPossuiCpf')) || undefined) || undefined,
    procedures: proceduresFrom(at),
    conditions: conditionsFrom(at),
  };
}

/**
 * Converte XML LEDI (envelope ou master) em Composition FHIR-like.
 * Mantém `sourceXml` para o exporter LEDI até haver serialização pura.
 */
export function lediXmlToComposition(xml: string): SigsComposition {
  const tipo = detectLediFichaTipo(xml);
  let uuidFicha: string | undefined;
  let cnes: string | undefined;
  let ine: string | undefined;
  let ibge: string | undefined;
  let cbo: string | undefined;
  let cnsProf: string | undefined;
  let atendimentos: XmlNode[] = [];

  try {
    if (tipo.id === 'FAO') {
      const extracted = extractFaoMasterFromXml(xml);
      const master = extracted.master as Record<string, unknown>;
      uuidFicha = typeof master.uuidFicha === 'string' ? master.uuidFicha : undefined;
      const header = (master.headerTransport || {}) as Record<string, unknown>;
      const lot = (header.lotacaoFormPrincipal || {}) as Record<string, unknown>;
      cnes = typeof lot.cnes === 'string' ? lot.cnes : undefined;
      ine = typeof lot.ine === 'string' ? lot.ine : undefined;
      cbo = typeof lot.cboCodigo_2002 === 'string' ? lot.cboCodigo_2002 : undefined;
      cnsProf = typeof lot.profissionalCNS === 'string' ? lot.profissionalCNS : undefined;
      ibge = typeof header.codigoIbgeMunicipio === 'string' ? header.codigoIbgeMunicipio : undefined;

      // Re-parse para nós de atendimento (master JSON perde ordem/lista em alguns casos)
      const root = parseXml(xml);
      const walk = (n: XmlNode): XmlNode[] => {
        if (n.name === 'atendimentosOdontologicos') return [n];
        return n.children.flatMap(walk);
      };
      atendimentos = walk(root);
    } else {
      const root = parseXml(xml);
      const walkNamed = (n: XmlNode, name: string): XmlNode[] => {
        if (n.name === name) return [n];
        return n.children.flatMap((c) => walkNamed(c, name));
      };
      uuidFicha = text(walkNamed(root, 'uuidFicha')[0]);
      const lotNodes = walkNamed(root, 'lotacaoFormPrincipal');
      if (lotNodes[0]) {
        cnes = text(child(lotNodes[0], 'cnes'));
        ine = text(child(lotNodes[0], 'ine'));
        cbo = text(child(lotNodes[0], 'cboCodigo_2002'));
        cnsProf = text(child(lotNodes[0], 'profissionalCNS'));
      }
      ibge = text(walkNamed(root, 'codigoIbgeMunicipio')[0]);
      // FAI/PROC: blocos de atendimento variam — captura tags comuns
      atendimentos = [
        ...walkNamed(root, 'atendimentos'),
        ...walkNamed(root, 'atendimentoIndividual'),
        ...walkNamed(root, 'procedimentos'),
      ];
      if (!atendimentos.length) {
        // fallback: qualquer nó com cnsCidadao/cpfCidadao
        const withId: XmlNode[] = [];
        const walk = (n: XmlNode) => {
          if (child(n, 'cnsCidadao') || child(n, 'cpfCidadao')) withId.push(n);
          n.children.forEach(walk);
        };
        walk(root);
        atendimentos = withId;
      }
    }
  } catch {
    return {
      resourceType: 'Composition',
      title: 'LEDI (parse falhou)',
      fichaTipo: tipo.id,
      fichaTipoCode: tipo.code,
      encounters: [],
      sourceFormat: 'ledi-xml',
      sourceXml: xml,
    };
  }

  const meta = {
    fichaTipo: tipo.id,
    uuidFicha,
    cnes,
    ine,
    ibge,
    cbo,
    cnsProf,
  };

  const encounters = atendimentos.map((at) => encounterFromAtendimento(at, meta));

  return {
    resourceType: 'Composition',
    title: tipo.label,
    fichaTipo: tipo.id,
    fichaTipoCode: tipo.code,
    uuidFicha,
    encounters,
    sourceFormat: 'ledi-xml',
    sourceXml: xml,
  };
}
