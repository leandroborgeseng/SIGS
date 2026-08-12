import { extractXmlFilesFromZipBuffer } from './ledi-zip.extract';
import JSZip from 'jszip';

describe('ledi-zip.extract', () => {
  it('extrai xmls de um zip em memória', async () => {
    const zip = new JSZip();
    zip.file(
      'pasta/cadastroatendimentoindividual-1.esus.xml',
      '<tipoDadoSerializado>4</tipoDadoSerializado><fichaAtendimentoIndividualMasterTransport/>',
    );
    zip.file('__MACOSX/._ignore.xml', 'x');
    const buf = Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
    const files = await extractXmlFilesFromZipBuffer(buf);
    expect(files).toHaveLength(1);
    expect(files[0]!.name).toContain('cadastroatendimentoindividual');
    expect(files[0]!.xml).toContain('tipoDadoSerializado');
  });
});
