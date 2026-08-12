/** Extrai .xml de um buffer ZIP (Finder “Comprimir”, etc.). */

import JSZip from 'jszip';

export async function extractXmlFilesFromZipBuffer(
  buf: Buffer,
): Promise<Array<{ name: string; xml: string }>> {
  const zip = await JSZip.loadAsync(buf);
  const out: Array<{ name: string; xml: string }> = [];

  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const base = entry.name.split('/').pop() || entry.name;
    if (base.startsWith('.') || base.startsWith('__MACOSX')) continue;
    if (!/\.xml$/i.test(base)) continue;
    const xml = await entry.async('string');
    if (!xml.trim()) continue;
    out.push({ name: base.slice(0, 255), xml });
  }

  if (!out.length) {
    throw new Error('ZIP sem arquivos .xml (confira se comprimiu a pasta certa).');
  }
  return out;
}
