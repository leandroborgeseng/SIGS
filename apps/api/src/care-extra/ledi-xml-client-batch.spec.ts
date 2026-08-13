import {
  assertLediTipoMatch,
  detectLediTipoId,
  dominantLediTipo,
  isJunkZipEntry,
  isLediXmlZipEntry,
  isLediTipoMismatchError,
  LediTipoMismatchError,
  sliceEntryRanges,
  uniqueBaseName,
} from '../../../web/src/lib/ledi-xml-batch';

describe('ledi-xml-batch (cliente)', () => {
  it('ignora __MACOSX / AppleDouble e aceita *.esus.xml em pasta e-SUS', () => {
    expect(isJunkZipEntry('__MACOSX/sistemas/._a.xml')).toBe(true);
    expect(isLediXmlZipEntry('sistemas/5974691/cadastroatendimentoindividual-1.esus.xml')).toBe(true);
    expect(isLediXmlZipEntry('sistemas/1/._cadastroprocedimentos-1.esus.xml')).toBe(false);
  });

  it('fatia por 80 fichas ou 1 MB', () => {
    const small = Array(200).fill(8_000);
    const ranges = sliceEntryRanges(small, 80, 1024 * 1024);
    expect(ranges[0]).toEqual({ start: 0, end: 80 });
    expect(ranges).toHaveLength(3);
    expect(ranges[2]).toEqual({ start: 160, end: 200 });

    const bulky = [400_000, 400_000, 400_000];
    const byBytes = sliceEntryRanges(bulky, 80, 1024 * 1024);
    expect(byBytes).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 3 },
    ]);
  });

  it('detecta FAO vs FAI e avisa na tela errada', () => {
    const fao = '<tipoDadoSerializado>5</tipoDadoSerializado><fichaAtendimentoOdontologicoMasterTransport/>';
    const fai = '<tipoDadoSerializado>4</tipoDadoSerializado><fichaAtendimentoIndividualMasterTransport/>';
    expect(detectLediTipoId(fao)).toBe('FAO');
    expect(detectLediTipoId(fai)).toBe('FAI');
    expect(dominantLediTipo([fao, fao, fai])).toBe('FAO');
    expect(() => assertLediTipoMatch({ expectedTipo: 'FAI', sampleXmls: [fao, fao] })).toThrow(
      LediTipoMismatchError,
    );
    try {
      assertLediTipoMatch({ expectedTipo: 'FAI', sampleXmls: [fao] });
    } catch (e) {
      expect(isLediTipoMismatchError(e)).toBe(true);
      expect(String(e)).toMatch(/Lote LEDI FAO/);
    }
    expect(() => assertLediTipoMatch({ expectedTipo: 'FAI', sampleXmls: [fai] })).not.toThrow();
  });

  it('uniqueBaseName achata pasta e-SUS', () => {
    const used = new Map<string, number>();
    expect(uniqueBaseName('sistemas/u/a.xml', used)).toBe('a.xml');
    expect(uniqueBaseName('sistemas/v/a.xml', used)).toBe('a-2.xml');
  });
});
