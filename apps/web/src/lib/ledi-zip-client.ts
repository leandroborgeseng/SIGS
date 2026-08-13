/**
 * Unzip LEDI no browser (fflate) — só ZIP ≤ ~5 MB (Arquivo.zip / amostra).
 * ZIP maior sobe em /upload-zip/chunk; o Node descompacta com yauzl.
 */

import { unzip } from 'fflate';
import {
  decodeXmlBytes,
  isLediXmlZipEntry,
  isMemoryError,
  uniqueBaseName,
  unzipFallbackMessage,
} from '@/lib/ledi-xml-batch';

export type LediZipXmlEntry = { name: string; bytes: Uint8Array };

function mapUnzipError(err: unknown, fileName: string): Error {
  if (isMemoryError(err)) return new Error(unzipFallbackMessage(fileName));
  const msg = err instanceof Error ? err.message : String(err || 'ZIP inválido');
  if (/encrypted|password/i.test(msg)) {
    return new Error('ZIP protegido por senha — o SIGS não abre arquivo criptografado.');
  }
  if (/compression|deflate64|unsupported|Invalid zip|Unknown compression/i.test(msg)) {
    return new Error(
      'ZIP com compressão não suportada. Recomprima no Finder (Comprimir) com Deflate/Store.',
    );
  }
  if (/corrupted|invalid|end of central|Unexpected EOF|Invalid zip data/i.test(msg)) {
    return new Error(`ZIP inválido ou corrompido: ${msg}`);
  }
  return err instanceof Error ? err : new Error(msg);
}

export function unzipLediXmlEntries(
  data: Uint8Array,
  fileName = 'lote.zip',
): Promise<LediZipXmlEntry[]> {
  return new Promise((resolve, reject) => {
    try {
      unzip(data, { filter: (f) => isLediXmlZipEntry(f.name) }, (err, files) => {
        if (err) {
          reject(mapUnzipError(err, fileName));
          return;
        }
        const used = new Map<string, number>();
        const out: LediZipXmlEntry[] = [];
        for (const [pathName, bytes] of Object.entries(files)) {
          if (!bytes?.length) continue;
          out.push({ name: uniqueBaseName(pathName, used), bytes });
        }
        if (!out.length) {
          reject(
            new Error(
              'ZIP sem arquivos .xml (confira se comprimiu a pasta certa; o SIGS ignora __MACOSX, AppleDouble e .DS_Store).',
            ),
          );
          return;
        }
        resolve(out);
      });
    } catch (e) {
      reject(mapUnzipError(e, fileName));
    }
  });
}

export function entryToXml(entry: LediZipXmlEntry): { name: string; xml: string } | null {
  const xml = decodeXmlBytes(entry.bytes).trim();
  if (!xml || xml.includes('\u0000')) return null;
  return { name: entry.name, xml };
}
