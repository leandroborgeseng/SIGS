/**
 * Extrai .xml de um ZIP no formato típico e-SUS/PEC + Finder “Comprimir”:
 * pastas internas (`sistemas/<unidade>/*.xml`), Deflate/Store, Zip64,
 * extra Unix, data descriptor, nomes CP437/IBM850/UTF-8.
 * Ignora __MACOSX, AppleDouble (._*), .DS_Store e path traversal.
 * ZIP grande (13–100 MB): yauzl em stream a partir do arquivo em disco.
 * ZIP pequeno / Buffer: JSZip. Não copia o e-SUS — parser próprio.
 */

import JSZip from 'jszip';
import yauzl from 'yauzl';

export type ExtractedXml = { name: string; xml: string };

export function lediBatchMaxFiles(): number {
  const n = Number(process.env.LEDI_BATCH_MAX_FILES || 20_000);
  return Number.isFinite(n) && n > 0 ? n : 20_000;
}

export function lediImportAsyncThreshold(): number {
  const n = Number(process.env.LEDI_IMPORT_ASYNC_THRESHOLD || 1500);
  return Number.isFinite(n) && n > 0 ? n : 1500;
}

/** Nomes no ZIP sem flag UTF-8 (0x800) costumam vir em CP437/IBM850; latin1 cobre o português comum. */
export function decodeZipFileName(bytes: Uint8Array | Buffer | number[]): string {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const utf8 = buf.toString('utf8');
  if (utf8.includes('\uFFFD')) return buf.toString('latin1');
  return utf8;
}

export function normalizeZipPath(name: string): string {
  return String(name || '').replace(/\\/g, '/');
}

export function isUnsafeZipPath(name: string): boolean {
  const n = normalizeZipPath(name);
  if (!n || n.startsWith('/') || /^[a-zA-Z]:/.test(n)) return true;
  return n.split('/').includes('..');
}

/** Resource forks, lixo do Finder e sentinelas — não são ficha LEDI. */
export function isJunkZipEntry(name: string): boolean {
  const n = normalizeZipPath(name);
  if (!n || n.endsWith('/')) return true;
  if (isUnsafeZipPath(n)) return true;
  if (n === '__MACOSX' || n.startsWith('__MACOSX/') || n.includes('/__MACOSX/')) return true;
  const base = n.split('/').pop() || n;
  if (base.startsWith('._') || base.startsWith('.')) return true;
  if (base.toLowerCase() === '.ds_store') return true;
  return false;
}

export function isLediXmlZipEntry(name: string): boolean {
  if (isJunkZipEntry(name)) return false;
  const base = normalizeZipPath(name).split('/').pop() || name;
  return /\.xml$/i.test(base);
}

export function mapZipLoadError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err || 'ZIP inválido');
  if (/encrypted/i.test(msg)) {
    return new Error('ZIP protegido por senha — o SIGS não abre arquivo criptografado.');
  }
  if (/compression method|deflate64|unsupported/i.test(msg)) {
    return new Error(
      'ZIP com compressão não suportada (ex.: Deflate64). Recomprima no Finder (Comprimir) ou use Deflate/Store.',
    );
  }
  if (/corrupted|invalid|end of central/i.test(msg)) {
    return new Error(`ZIP inválido ou corrompido: ${msg}`);
  }
  return err instanceof Error ? err : new Error(msg);
}

function decodeXmlBytes(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.slice(3).toString('utf8');
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.slice(2).toString('utf16le');
  }
  const head = buf.slice(0, 240).toString('latin1');
  const m = head.match(/encoding\s*=\s*["']([^"']+)["']/i);
  const enc = (m?.[1] || '').toLowerCase();
  if (
    enc &&
    enc !== 'utf-8' &&
    enc !== 'utf8' &&
    /8859|latin|windows-1252|cp1252|iso-8859|ibm850|cp850/i.test(enc)
  ) {
    return buf.toString('latin1');
  }
  return buf.toString('utf8');
}

function uniqueBaseName(pathName: string, used: Map<string, number>): string {
  const base = (normalizeZipPath(pathName).split('/').pop() || pathName).slice(0, 240);
  const n = (used.get(base) || 0) + 1;
  used.set(base, n);
  if (n === 1) return base.slice(0, 255);
  const suffixed = base.replace(/\.xml$/i, '') + `-${n}.xml`;
  return suffixed.slice(0, 255);
}

export async function loadLediZip(buf: Buffer): Promise<JSZip> {
  try {
    return await JSZip.loadAsync(buf, {
      decodeFileName: (bytes) => decodeZipFileName(bytes as Uint8Array | Buffer | number[]),
    });
  } catch (e) {
    throw mapZipLoadError(e);
  }
}

export function listLediXmlEntries(zip: JSZip): JSZip.JSZipObject[] {
  return Object.values(zip.files).filter((entry) => !entry.dir && isLediXmlZipEntry(entry.name));
}

export async function extractXmlFilesFromLoadedZip(zip: JSZip): Promise<ExtractedXml[]> {
  const entries = listLediXmlEntries(zip);
  const max = lediBatchMaxFiles();
  if (entries.length > max) {
    throw new Error(
      `ZIP tem ${entries.length} arquivos .xml; o limite por lote é ${max}. Divida o lote (por unidade/período) ou envie em partes.`,
    );
  }
  const used = new Map<string, number>();
  const out: ExtractedXml[] = [];
  for (const entry of entries) {
    const bytes = await entry.async('nodebuffer');
    const xml = decodeXmlBytes(bytes);
    if (!xml.trim()) continue;
    if (xml.includes('\u0000')) continue;
    out.push({ name: uniqueBaseName(entry.name, used), xml });
  }
  if (!out.length) {
    throw new Error(
      'ZIP sem arquivos .xml (confira se comprimiu a pasta certa; o SIGS ignora __MACOSX, AppleDouble e .DS_Store).',
    );
  }
  return out;
}

export async function extractXmlFilesFromZipBuffer(buf: Buffer): Promise<ExtractedXml[]> {
  const zip = await loadLediZip(buf);
  return extractXmlFilesFromLoadedZip(zip);
}

export async function countLediXmlInZipBuffer(buf: Buffer): Promise<number> {
  const zip = await loadLediZip(buf);
  return listLediXmlEntries(zip).length;
}

function emptyZipError(): Error {
  return new Error(
    'ZIP sem arquivos .xml (confira se comprimiu a pasta certa; o SIGS ignora __MACOSX, AppleDouble e .DS_Store).',
  );
}

function tooManyXmlError(n: number, max: number): Error {
  return new Error(
    `ZIP tem ${n} arquivos .xml; o limite por lote é ${max}. Divida o lote (por unidade/período) ou envie em partes.`,
  );
}

function readYauzlEntryBuffer(
  zipfile: yauzl.ZipFile,
  entry: yauzl.Entry,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err, stream) => {
      if (err || !stream) {
        reject(err || new Error('Falha ao ler entrada do ZIP'));
        return;
      }
      const chunks: Buffer[] = [];
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  });
}

/**
 * Unzip em stream a partir do disco (não carrega o ZIP inteiro em RAM).
 * Pastas e-SUS (`sistemas/<unidade>/*.xml`); ignora `__MACOSX`.
 */
export function extractXmlFilesFromZipPath(zipPath: string): Promise<ExtractedXml[]> {
  const max = lediBatchMaxFiles();
  return new Promise((resolve, reject) => {
    yauzl.open(
      zipPath,
      { lazyEntries: true, autoClose: true, decodeStrings: false },
      (err, zipfile) => {
      if (err || !zipfile) {
        reject(mapZipLoadError(err || new Error('ZIP inválido')));
        return;
      }
      const used = new Map<string, number>();
      const out: ExtractedXml[] = [];
      let xmlSeen = 0;

      const fail = (e: unknown) => {
        try {
          zipfile.close();
        } catch {
          /* ignore */
        }
        reject(e instanceof Error ? e : new Error(String(e)));
      };

      zipfile.on('error', (e) => fail(mapZipLoadError(e)));
      zipfile.on('end', () => {
        if (!out.length) {
          reject(emptyZipError());
          return;
        }
        resolve(out);
      });
      zipfile.on('entry', (entry: yauzl.Entry) => {
        const raw = entry.fileName as unknown as Buffer | string;
        const name = decodeZipFileName(Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw), 'binary'));
        if (!isLediXmlZipEntry(name)) {
          zipfile.readEntry();
          return;
        }
        xmlSeen += 1;
        if (xmlSeen > max) {
          fail(tooManyXmlError(xmlSeen, max));
          return;
        }
        void readYauzlEntryBuffer(zipfile, entry)
          .then((bytes) => {
            const xml = decodeXmlBytes(bytes);
            if (xml.trim() && !xml.includes('\u0000')) {
              out.push({ name: uniqueBaseName(name, used), xml });
            }
            zipfile.readEntry();
          })
          .catch((e) => fail(mapZipLoadError(e)));
      });
      zipfile.readEntry();
    },
    );
  });
}
