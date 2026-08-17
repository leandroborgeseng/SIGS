/**
 * Carrega pacote SIGTAP local (offline) — TXT/ZIP/JSON/CSV em data/sigtap/.
 * Não baixa do site DATASUS (instável); o município coloca o arquivo.
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import { basename, extname, join, resolve } from 'path';
import JSZip from 'jszip';
import { parseTbProcedimentoText, type MsProcedimentoRow } from './ms-procedimento.parser';

export type SigtapLocalKind = 'tb_procedimento' | 'json_stub' | 'csv';

export type SigtapLocalPayload = {
  kind: SigtapLocalKind;
  path: string;
  /** Conteúdo TB_PROCEDIMENTO (quando kind=tb_procedimento) */
  content?: string;
  /** Payload JSON import stub */
  json?: { competencia?: string; items: Array<Record<string, unknown>> };
  /** Linhas CSV parseadas */
  csvRows?: MsProcedimentoRow[];
  detectedCompetencia?: string;
};

function candidateDataDirs(): string[] {
  const roots = [
    process.env.SIGTAP_DATA_DIR,
    '/app/data/sigtap',
    join(process.cwd(), 'data', 'sigtap'),
    join(process.cwd(), '..', '..', 'data', 'sigtap'),
    join(process.cwd(), '..', 'data', 'sigtap'),
    join(__dirname, '..', '..', '..', '..', 'data', 'sigtap'),
    join(__dirname, '..', '..', '..', '..', '..', 'data', 'sigtap'),
  ].filter(Boolean) as string[];
  return [...new Set(roots.map((r) => resolve(r)))];
}

/** Diretórios data/sigtap existentes (primeiro = preferido). */
export function resolveSigtapDataDirs(): string[] {
  return candidateDataDirs().filter((d) => existsSync(d));
}

export function resolveSigtapDataDir(): string | null {
  return resolveSigtapDataDirs()[0] || null;
}

/** Preferência: ZIP oficial > TB_PROCEDIMENTO.txt > fixture sample > piloto JSON. */
export function discoverDefaultSigtapFile(dir?: string): string | null {
  const roots = dir ? [resolve(dir)] : resolveSigtapDataDirs();
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const names = readdirSync(root);
    const prefer = [
      names.find((n) => /\.zip$/i.test(n) && /sigtap|procedimento|TabelaUnificada/i.test(n)),
      names.find((n) => /\.zip$/i.test(n)),
      names.find((n) => /^TB_PROCEDIMENTO\.txt$/i.test(n)),
      names.find((n) => /TB_PROCEDIMENTO/i.test(n) && /\.txt$/i.test(n)),
      names.find((n) => /fixture-tb-procedimento/i.test(n) && /\.txt$/i.test(n)),
      names.find((n) => /^piloto-franca\.json$/i.test(n)),
      names.find((n) => /\.json$/i.test(n) && /piloto|sigtap/i.test(n)),
    ].filter(Boolean) as string[];
    if (prefer[0]) return resolve(root, prefer[0]);
  }
  return null;
}

async function extractTbFromZip(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const entries = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
  const hit =
    entries.find((n) => /TB_PROCEDIMENTO\.txt$/i.test(n)) ||
    entries.find((n) => /procedimento\.txt$/i.test(basename(n)));
  if (!hit) {
    throw new Error(
      `ZIP sem TB_PROCEDIMENTO.txt (encontrou: ${entries.slice(0, 8).join(', ') || 'vazio'})`,
    );
  }
  return zip.file(hit)!.async('string');
}

/** CSV simples: code,name[,competencia] — cabeçalho opcional. */
export function parseSigtapCsv(content: string, competenciaFallback?: string): MsProcedimentoRow[] {
  const rows: MsProcedimentoRow[] = [];
  for (const raw of content.split(/\n/)) {
    const line = raw.replace(/\r$/, '').trim();
    if (!line || /^code\b/i.test(line) || /^co_procedimento\b/i.test(line)) continue;
    const parts = line.includes(';') ? line.split(';') : line.split(',');
    const code = String(parts[0] || '')
      .replace(/\D/g, '')
      .slice(0, 10);
    const name = String(parts[1] || '').trim().replace(/^"|"$/g, '');
    let competencia = String(parts[2] || '')
      .replace(/\D/g, '')
      .slice(0, 6);
    if (!/^\d{9,10}$/.test(code) || !name) continue;
    if (!/^\d{6}$/.test(competencia)) competencia = competenciaFallback || '';
    rows.push({
      code,
      name,
      groupCode: code.slice(0, 2),
      competencia,
    });
  }
  return rows;
}

export async function loadSigtapLocalFile(
  filePath: string,
  opts?: { competenciaFallback?: string },
): Promise<SigtapLocalPayload> {
  const path = resolve(filePath);
  if (!existsSync(path)) throw new Error(`Arquivo não encontrado: ${path}`);

  const ext = extname(path).toLowerCase();
  const base = basename(path).toLowerCase();

  if (ext === '.zip') {
    const content = await extractTbFromZip(readFileSync(path));
    const parsed = parseTbProcedimentoText(content, {
      competenciaFallback: opts?.competenciaFallback,
    });
    return {
      kind: 'tb_procedimento',
      path,
      content,
      detectedCompetencia: parsed.detectedCompetencia,
    };
  }

  if (ext === '.json' || base.endsWith('.json')) {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as {
      competencia?: string;
      items?: Array<Record<string, unknown>>;
    };
    if (!Array.isArray(raw.items) || !raw.items.length) {
      throw new Error('JSON stub inválido — espere { competencia?, items: [...] }');
    }
    return {
      kind: 'json_stub',
      path,
      json: { competencia: raw.competencia || opts?.competenciaFallback, items: raw.items },
      detectedCompetencia: raw.competencia,
    };
  }

  if (ext === '.csv') {
    const text = readFileSync(path, 'utf8');
    const csvRows = parseSigtapCsv(text, opts?.competenciaFallback);
    if (!csvRows.length) throw new Error('CSV sem linhas válidas (code,name[,competencia])');
    return {
      kind: 'csv',
      path,
      csvRows,
      detectedCompetencia: csvRows.find((r) => r.competencia)?.competencia,
    };
  }

  // .txt / sem extensão / TB_PROCEDIMENTO
  const content = readFileSync(path, 'utf8');
  const parsed = parseTbProcedimentoText(content, {
    competenciaFallback: opts?.competenciaFallback,
  });
  if (!parsed.rows.length) {
    throw new Error('Nenhum procedimento no TXT — layout TB_PROCEDIMENTO (largura fixa) esperado');
  }
  return {
    kind: 'tb_procedimento',
    path,
    content,
    detectedCompetencia: parsed.detectedCompetencia,
  };
}

export async function extractTbProcedimentoFromBuffer(
  buf: Buffer,
  filename: string,
): Promise<{ content: string; fromZip: boolean }> {
  const name = (filename || '').toLowerCase();
  const isZip = name.endsWith('.zip') || (buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b);
  if (isZip) {
    return { content: await extractTbFromZip(buf), fromZip: true };
  }
  return { content: buf.toString('utf8'), fromZip: false };
}
