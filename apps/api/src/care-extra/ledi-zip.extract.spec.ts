import {
  extractXmlFilesFromZipBuffer,
  extractXmlFilesFromZipPath,
  isJunkZipEntry,
  isLediXmlZipEntry,
  lediBatchMaxFiles,
} from './ledi-zip.extract';
import JSZip from 'jszip';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';

async function zipBuf(build: (z: JSZip) => void): Promise<Buffer> {
  const zip = new JSZip();
  build(zip);
  return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
}

describe('ledi-zip.extract', () => {
  it('extrai xmls de pasta interna e ignora __MACOSX / AppleDouble', async () => {
    const buf = await zipBuf((zip) => {
      zip.file(
        'sistemas/5974691/cadastroatendimentoindividual-1.esus.xml',
        '<tipoDadoSerializado>4</tipoDadoSerializado><fichaAtendimentoIndividualMasterTransport/>',
      );
      zip.file(
        '__MACOSX/sistemas/5974691/._cadastroatendimentoindividual-1.esus.xml',
        '\u0000appledouble',
      );
      zip.file('sistemas/.DS_Store', 'ds');
      zip.file('__MACOSX/._sistemas', 'x');
    });
    const files = await extractXmlFilesFromZipBuffer(buf);
    expect(files).toHaveLength(1);
    expect(files[0]!.name).toContain('cadastroatendimentoindividual');
    expect(files[0]!.xml).toContain('tipoDadoSerializado');
  });

  it('aceita Zip64 (JSZip) com xml na raiz', async () => {
    const zip = new JSZip();
    zip.file('ficha.xml', '<tipoDadoSerializado>5</tipoDadoSerializado>');
    const buf = Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
    const files = await extractXmlFilesFromZipBuffer(buf);
    expect(files).toHaveLength(1);
    expect(files[0]!.name).toBe('ficha.xml');
  });

  it('rejeita ZIP só com lixo do Finder', async () => {
    const buf = await zipBuf((zip) => {
      zip.file('__MACOSX/._nada.xml', 'x');
      zip.file('.DS_Store', 'ds');
    });
    await expect(extractXmlFilesFromZipBuffer(buf)).rejects.toThrow(/ZIP sem arquivos \.xml/);
  });

  it('respeita LEDI_BATCH_MAX_FILES antes de materializar o lote', async () => {
    const prev = process.env.LEDI_BATCH_MAX_FILES;
    process.env.LEDI_BATCH_MAX_FILES = '2';
    try {
      expect(lediBatchMaxFiles()).toBe(2);
      const buf = await zipBuf((zip) => {
        zip.file('a.xml', '<x/>');
        zip.file('b.xml', '<x/>');
        zip.file('c.xml', '<x/>');
      });
      await expect(extractXmlFilesFromZipBuffer(buf)).rejects.toThrow(/ZIP tem 3 arquivos/);
    } finally {
      if (prev == null) delete process.env.LEDI_BATCH_MAX_FILES;
      else process.env.LEDI_BATCH_MAX_FILES = prev;
    }
  });

  it('classifica path traversal e __MACOSX como lixo', () => {
    expect(isJunkZipEntry('../secret.xml')).toBe(true);
    expect(isJunkZipEntry('__MACOSX/foo.xml')).toBe(true);
    expect(isLediXmlZipEntry('sistemas/1/cadastroprocedimentos-1.esus.xml')).toBe(true);
    expect(isLediXmlZipEntry('sistemas/1/._cadastroprocedimentos-1.esus.xml')).toBe(false);
  });

  it('yauzl em disco extrai pasta e-SUS e ignora __MACOSX', async () => {
    const buf = await zipBuf((zip) => {
      zip.file(
        'sistemas/5974691/cadastroatendimentoindividual-1.esus.xml',
        '<tipoDadoSerializado>4</tipoDadoSerializado><fichaAtendimentoIndividualMasterTransport/>',
      );
      zip.file('__MACOSX/sistemas/._x.xml', '\u0000x');
    });
    const dir = await mkdtemp(path.join(os.tmpdir(), 'ledi-yauzl-'));
    const zipPath = path.join(dir, 'lote.zip');
    try {
      await writeFile(zipPath, buf);
      const files = await extractXmlFilesFromZipPath(zipPath);
      expect(files).toHaveLength(1);
      expect(files[0]!.name).toContain('cadastroatendimentoindividual');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
