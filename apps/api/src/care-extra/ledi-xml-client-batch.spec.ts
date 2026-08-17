import {
  assertLediTipoMatch,
  detectLediTipoId,
  dominantLediTipo,
  isJunkZipEntry,
  isLediXmlZipEntry,
  isLediTipoMismatchError,
  lediTelaAcceptCopy,
  LediTipoMismatchError,
  parseLediTipoMismatchFromJob,
  sliceEntryRanges,
  uniqueBaseName,
  BROWSER_UNZIP_MAX_BYTES,
  shouldUnzipZipInBrowser,
} from '../../../web/src/lib/ledi-xml-batch';

describe('ledi-xml-batch (cliente)', () => {
  it('ZIP pequeno não unzipa no browser (POST /upload ~0.2 MB Load-failed no Safari)', () => {
    expect(shouldUnzipZipInBrowser(200 * 1024)).toBe(false);
    expect(shouldUnzipZipInBrowser(4 * 1024 * 1024)).toBe(false);
    expect(shouldUnzipZipInBrowser(13 * 1024 * 1024)).toBe(false);
    expect(BROWSER_UNZIP_MAX_BYTES).toBe(0);
  });

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

  it('Cadastro Individual tipo 2 na tela certa passa; FAO na tela 2 aponta FAO', () => {
    const ci = '<tipoDadoSerializado>2</tipoDadoSerializado><cadastroIndividualTransport/>';
    const fao = '<tipoDadoSerializado>5</tipoDadoSerializado><fichaAtendimentoOdontologicoMasterTransport/>';
    expect(detectLediTipoId(ci)).toBe('CADASTRO_INDIVIDUAL');
    expect(() =>
      assertLediTipoMatch({ expectedTipo: 'CADASTRO_INDIVIDUAL', sampleXmls: [ci] }),
    ).not.toThrow();
    try {
      assertLediTipoMatch({ expectedTipo: 'CADASTRO_INDIVIDUAL', sampleXmls: [fao] });
      fail('expected throw');
    } catch (e) {
      expect(isLediTipoMismatchError(e)).toBe(true);
      const err = e as LediTipoMismatchError;
      expect(err.detectedTipo).toBe('FAO');
      expect(err.expectedTipo).toBe('CADASTRO_INDIVIDUAL');
      expect(err.href).toBe('/faturamento/lote/fao');
      expect(String(e)).toMatch(/Lote LEDI FAO/);
      expect(String(e)).toMatch(/Cadastro Individual/);
      expect(String(e)).not.toMatch(/não FAO\./);
    }
  });

  it('lediTelaAcceptCopy não diz Procedimentos tipo 7 nas telas CDS', () => {
    expect(lediTelaAcceptCopy('CADASTRO_INDIVIDUAL')).toBe(
      'Esta tela aceita só Cadastro Individual (tipo 2).',
    );
    expect(lediTelaAcceptCopy('CADASTRO_DOMICILIAR')).toMatch(/tipo 3/);
    expect(lediTelaAcceptCopy('COLETIVO')).toMatch(/tipo 6/);
    expect(lediTelaAcceptCopy('VISITA_ACS')).toMatch(/tipo 8/);
    expect(lediTelaAcceptCopy('AD')).toMatch(/tipo 10/);
    expect(lediTelaAcceptCopy('PROCEDIMENTOS')).toBe(
      'Esta tela aceita só Procedimentos (tipo 7).',
    );
    expect(lediTelaAcceptCopy('CADASTRO_INDIVIDUAL')).not.toMatch(/Procedimentos/);
  });

  it('parseLediTipoMismatchFromJob lê recusa do servidor', () => {
    const err = parseLediTipoMismatchFromJob({
      errorMessage: 'Este ZIP é FAO, não FAI. não analisamos este arquivo.',
      result: {
        code: 'LEDI_TIPO_MISMATCH',
        expectedTipo: 'FAI',
        detectedTipo: 'FAO',
        href: '/faturamento/lote/fao',
        message: 'x',
      },
    });
    expect(err?.code).toBe('LEDI_TIPO_MISMATCH');
    expect(err?.detectedTipo).toBe('FAO');
    expect(err?.href).toBe('/faturamento/lote/fao');
  });

  it('uniqueBaseName achata pasta e-SUS', () => {
    const used = new Map<string, number>();
    expect(uniqueBaseName('sistemas/u/a.xml', used)).toBe('a.xml');
    expect(uniqueBaseName('sistemas/v/a.xml', used)).toBe('a-2.xml');
  });
});
