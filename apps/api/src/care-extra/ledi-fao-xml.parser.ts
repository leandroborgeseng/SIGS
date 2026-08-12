/**
 * Parser XML minimalista para ficha LEDI FAO (Atendimento Odontológico).
 * Sem dependência externa — suficiente para validação estrutural de conformidade.
 */

export type XmlNode = {
  name: string;
  attrs: Record<string, string>;
  text: string;
  children: XmlNode[];
};

function localName(tag: string): string {
  const bare = tag.replace(/^\/?/, '').split(/\s/)[0] || '';
  const parts = bare.split(':');
  return (parts[parts.length - 1] || '').trim();
}

function parseAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([:\w.-]+)\s*=\s*(["'])(.*?)\2/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    out[m[1]] = m[3];
  }
  return out;
}

/** Converte XML em árvore (ignora declaração, comentários e CDATA wrapper). */
export function parseXml(xml: string): XmlNode {
  const cleaned = xml
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .trim();
  if (!cleaned.startsWith('<')) {
    throw new Error('XML inválido: não começa com tag');
  }

  const root: XmlNode = { name: '#root', attrs: {}, text: '', children: [] };
  const stack: XmlNode[] = [root];
  const tokenRe = /<\/?[^>]+>|[^<]+/g;
  let token: RegExpExecArray | null;
  while ((token = tokenRe.exec(cleaned))) {
    const chunk = token[0];
    if (chunk.startsWith('</')) {
      const name = localName(chunk.slice(2, -1));
      if (stack.length <= 1) throw new Error(`Fechamento sem abertura: ${name}`);
      const top = stack[stack.length - 1]!;
      if (top.name !== name) {
        throw new Error(`Tags desalinhadas: esperado </${top.name}>, veio </${name}>`);
      }
      stack.pop();
      continue;
    }
    if (chunk.startsWith('<')) {
      const selfClose = /\/\s*>$/.test(chunk);
      const inner = chunk.replace(/^<\s*/, '').replace(/\/?\s*>$/, '');
      const sp = inner.search(/\s/);
      const rawName = sp === -1 ? inner : inner.slice(0, sp);
      const name = localName(rawName);
      if (!name) throw new Error('Tag sem nome');
      const attrs = sp === -1 ? {} : parseAttrs(inner.slice(sp));
      const node: XmlNode = { name, attrs, text: '', children: [] };
      stack[stack.length - 1]!.children.push(node);
      if (!selfClose) stack.push(node);
      continue;
    }
    const text = chunk.replace(/\s+/g, ' ').trim();
    if (text) {
      const cur = stack[stack.length - 1]!;
      cur.text = cur.text ? `${cur.text} ${text}` : text;
    }
  }
  if (stack.length !== 1) throw new Error('XML incompleto (tags não fechadas)');
  if (root.children.length !== 1) {
    // aceita múltiplos irmãos sob root virtual — usa o primeiro elemento
    if (!root.children.length) throw new Error('XML sem elemento raiz');
  }
  return root.children[0]!;
}

function textOf(node: XmlNode | undefined): string | undefined {
  if (!node) return undefined;
  if (node.text) return node.text.trim();
  if (node.children.length === 1 && !node.children[0]!.children.length) {
    return node.children[0]!.text.trim() || undefined;
  }
  return undefined;
}

function childrenNamed(node: XmlNode, name: string): XmlNode[] {
  return node.children.filter((c) => c.name === name);
}

function firstChild(node: XmlNode, name: string): XmlNode | undefined {
  return childrenNamed(node, name)[0];
}

function collectList(node: XmlNode | undefined, itemNames: string[]): unknown[] {
  if (!node) return [];
  const items: unknown[] = [];
  for (const child of node.children) {
    if (itemNames.includes(child.name) || child.name === 'item' || child.name === 'value') {
      if (child.children.length) items.push(nodeToPlain(child));
      else if (child.text.trim()) items.push(coerceScalar(child.text.trim()));
    } else if (child.text.trim() && !child.children.length) {
      // lista flat: <tiposEncamOdonto>17</tiposEncamOdonto> repetido
      items.push(coerceScalar(child.text.trim()));
    }
  }
  // se o próprio nó é valor único em lista tipada
  if (!items.length && node.text.trim()) {
    return [coerceScalar(node.text.trim())];
  }
  // lista de números em nós com mesmo nome do pai (padrão LEDI)
  if (!items.length) {
    for (const child of node.children) {
      if (child.name === node.name || child.name.toLowerCase().includes('tipo')) {
        const t = textOf(child);
        if (t != null) items.push(coerceScalar(t));
        else items.push(nodeToPlain(child));
      }
    }
  }
  return items;
}

function coerceScalar(v: string): string | number | boolean {
  if (v === 'true') return true;
  if (v === 'false') return false;
  // preservar zeros à esquerda (SIGTAP, CNS, CPF, CNES…)
  if (/^\d+$/.test(v) && (v.startsWith('0') || v.length >= 10)) return v;
  if (/^-?\d+$/.test(v)) {
    const n = Number(v);
    if (Number.isSafeInteger(n)) return n;
  }
  return v;
}

function nodeToPlain(node: XmlNode): unknown {
  if (!node.children.length) {
    return node.text ? coerceScalar(node.text.trim()) : node.attrs;
  }
  const out: Record<string, unknown> = {};
  const counts = new Map<string, number>();
  for (const c of node.children) counts.set(c.name, (counts.get(c.name) || 0) + 1);

  for (const c of node.children) {
    const multi = (counts.get(c.name) || 0) > 1;
    const val = c.children.length ? nodeToPlain(c) : coerceScalar(c.text.trim());
    if (multi) {
      const arr = (out[c.name] as unknown[]) || [];
      arr.push(val);
      out[c.name] = arr;
    } else if (out[c.name] !== undefined) {
      out[c.name] = [out[c.name], val];
    } else {
      out[c.name] = val;
    }
  }
  if (node.text.trim()) out._text = coerceScalar(node.text.trim());
  return out;
}

/** Detecta Bundle FHIR / RIA RNDS vs ficha LEDI FAO. */
export function detectXmlKind(rootName: string, xml: string): 'ledi-fao' | 'fhir-bundle' | 'dado-transport' | 'unknown' {
  const n = rootName.toLowerCase();
  if (n.includes('bundle') || /"resourceType"\s*:\s*"Bundle"/i.test(xml) || /xmlns[^>]*hl7\.org\/fhir/i.test(xml)) {
    return 'fhir-bundle';
  }
  // Envelope dadoTransport com FAO XML embutida (export PEC/SIGS) = LEDI FAO.
  if (
    n.includes('fichaatendimentoodontologico') ||
    n.includes('atendimentoodontologico') ||
    /atendimentosOdontologicos/i.test(xml) ||
    /fichaAtendimentoOdontologicoMaster/i.test(xml)
  ) {
    return 'ledi-fao';
  }
  if (n.includes('dadotransport') || n === 'dadotransportthrift' || n.includes('lotetransport')) {
    return 'dado-transport';
  }
  return 'unknown';
}

/**
 * Extrai objeto master FAO a partir de XML LEDI (várias formas de aninhamento).
 */
export function extractFaoMasterFromXml(xml: string): {
  kind: ReturnType<typeof detectXmlKind>;
  rootName: string;
  master: Record<string, unknown> | null;
  rawPlain: unknown;
} {
  const root = parseXml(xml);
  const kind = detectXmlKind(root.name, xml);
  const plain = nodeToPlain(root) as Record<string, unknown>;

  if (kind === 'fhir-bundle') {
    return { kind, rootName: root.name, master: null, rawPlain: plain };
  }

  // Envelope Thrift/binário sem FAO XML estruturada.
  if (kind === 'dado-transport') {
    return { kind, rootName: root.name, master: null, rawPlain: plain };
  }

  // raiz já é master
  if (plain.atendimentosOdontologicos || plain.headerTransport || plain.uuidFicha) {
    return {
      kind: 'ledi-fao',
      rootName: root.name,
      master: normalizeMaster(plain, envelopeHints(plain)),
      rawPlain: plain,
    };
  }

  // procurar master aninhado (inclui dadoTransporteTransportXml → ficha…MasterTransport)
  const nested =
    asRecord(plain.FichaAtendimentoOdontologicoMaster) ||
    asRecord(plain.fichaAtendimentoOdontologicoMaster) ||
    asRecord(plain.fichaAtendimentoOdontologicoMasterTransport) ||
    findDeep(plain, (o) => !!(o.atendimentosOdontologicos && (o.uuidFicha || o.headerTransport)));

  if (nested) {
    return {
      kind: 'ledi-fao',
      rootName: root.name,
      master: normalizeMaster(nested, envelopeHints(plain)),
      rawPlain: plain,
    };
  }

  return { kind, rootName: root.name, master: null, rawPlain: plain };
}

/** CNES/INE do envelope de transporte quando a lotação não traz. */
function envelopeHints(plain: Record<string, unknown>): { cnes?: string; ine?: string; ibge?: string } {
  return {
    cnes: strOrUndef(plain.cnesDadoSerializado ?? plain.cnes),
    ine: strOrUndef(plain.ineDadoSerializado ?? plain.ine),
    ibge: strOrUndef(plain.codIbge ?? plain.codigoIbgeMunicipio),
  };
}

function strOrUndef(v: unknown): string | undefined {
  if (v == null || v === '') return undefined;
  return String(v).trim() || undefined;
}

function findDeep(
  obj: unknown,
  pred: (o: Record<string, unknown>) => boolean,
): Record<string, unknown> | null {
  if (!obj || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const hit = findDeep(item, pred);
      if (hit) return hit;
    }
    return null;
  }
  const rec = obj as Record<string, unknown>;
  if (pred(rec)) return rec;
  for (const v of Object.values(rec)) {
    const hit = findDeep(v, pred);
    if (hit) return hit;
  }
  return null;
}

function asArray(v: unknown): unknown[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function normalizeMaster(
  m: Record<string, unknown>,
  hints: { cnes?: string; ine?: string; ibge?: string } = {},
): Record<string, unknown> {
  const rawList = asArray(
    m.atendimentosOdontologicos ??
      m.FichaAtendimentoOdontologicoChild ??
      m.atendimentoOdontologico,
  );
  const atendimentos = rawList.map((c) => {
    let rec = asRecord(c) || {};
    // XML LEDI frequentemente envolve o child: <atendimentosOdontologicos><FichaAtendimentoOdontologicoChild>…
    const nested =
      asRecord(rec.FichaAtendimentoOdontologicoChild) ||
      asRecord(rec.fichaAtendimentoOdontologicoChild) ||
      asRecord(rec.child);
    if (nested) rec = nested;
    return normalizeChild(rec);
  });

  const header = asRecord(m.headerTransport) || asRecord(m.VariasLotacoesHeader) || {};
  const lotacao =
    asRecord(header.lotacaoFormPrincipal) ||
    asRecord(header.profissional) ||
    asRecord(m.lotacaoFormPrincipal) ||
    {};

  const cnes = header.cnes ?? lotacao.cnes ?? hints.cnes;
  const ine = header.ine ?? lotacao.ine ?? hints.ine;
  const ibge = header.codigoIbgeMunicipio ?? header.codIbge ?? hints.ibge;

  return {
    ...m,
    uuidFicha: m.uuidFicha ?? m.uuid,
    tpCdsOrigem: m.tpCdsOrigem,
    headerTransport: {
      ...header,
      profissionalCNS: header.profissionalCNS ?? lotacao.profissionalCNS,
      cboCodigo_2002: header.cboCodigo_2002 ?? lotacao.cboCodigo_2002 ?? header.cbo,
      cnes,
      ine,
      dataAtendimento: header.dataAtendimento ?? header.dataAtendimentoEpoch,
      codigoIbgeMunicipio: ibge,
      lotacaoFormPrincipal: {
        profissionalCNS: lotacao.profissionalCNS ?? header.profissionalCNS,
        cboCodigo_2002: lotacao.cboCodigo_2002 ?? header.cboCodigo_2002 ?? header.cbo,
        cnes: lotacao.cnes ?? header.cnes ?? hints.cnes,
        ine: lotacao.ine ?? header.ine ?? hints.ine,
      },
    },
    atendimentosOdontologicos: atendimentos,
  };
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function normalizeChild(c: Record<string, unknown>): Record<string, unknown> {
  const procsRaw = asArray(c.procedimentosRealizados ?? c.procedimentoQuantidade ?? c.procedimentos);
  const procs = procsRaw.flatMap((p) => {
    const r = asRecord(p) || {};
    // unwrap <ProcedimentoQuantidade>
    const nested =
      asRecord(r.ProcedimentoQuantidade) ||
      asRecord(r.procedimentoQuantidade) ||
      (r.coMsProcedimento != null || r.codigo != null ? r : null);
    if (Array.isArray(r.ProcedimentoQuantidade)) {
      return (r.ProcedimentoQuantidade as unknown[]).map((x) => {
        const n = asRecord(x) || {};
        return {
          coMsProcedimento: String(n.coMsProcedimento ?? n.codigo ?? n.code ?? '').replace(/\D/g, ''),
          quantidade: Number(n.quantidade ?? n.qtd ?? 1),
        };
      });
    }
    if (typeof p === 'string' || typeof p === 'number') {
      return [{ coMsProcedimento: String(p).replace(/\D/g, ''), quantidade: 1 }];
    }
    const src = nested || r;
    return [
      {
        coMsProcedimento: String(src.coMsProcedimento ?? src.codigo ?? src.code ?? '').replace(/\D/g, ''),
        quantidade: Number(src.quantidade ?? src.qtd ?? 1),
      },
    ];
  });

  return {
    ...c,
    cpfCidadao: c.cpfCidadao ?? c.cpf,
    cnsCidadao: c.cnsCidadao ?? c.cns,
    tiposEncamOdonto: flattenCodes(c.tiposEncamOdonto ?? c.condutas),
    tiposVigilanciaSaudeBucal: flattenCodes(c.tiposVigilanciaSaudeBucal ?? c.vigilanciaSaudeBucal),
    tiposConsultaOdonto: flattenCodes(c.tiposConsultaOdonto),
    tiposFornecimOdonto: flattenCodes(c.tiposFornecimOdonto),
    procedimentosRealizados: procs,
    problemasCondicoes: asArray(c.problemasCondicoes ?? c.problemaCondicao ?? c.problemas),
  };
}

function flattenCodes(v: unknown): number[] {
  return asArray(v)
    .flatMap((item) => {
      if (typeof item === 'number') return [item];
      if (typeof item === 'string' && /^-?\d+$/.test(item)) return [Number(item)];
      const r = asRecord(item);
      if (r) {
        const n = r.id ?? r.codigo ?? r.code ?? r._text;
        if (typeof n === 'number') return [n];
        if (typeof n === 'string' && /^-?\d+$/.test(n)) return [Number(n)];
      }
      return [];
    })
    .filter((n) => Number.isFinite(n));
}

/** Helpers exportados para testes / JSON path */
export const faoParseHelpers = { asArray, textOf, firstChild, childrenNamed, collectList };
