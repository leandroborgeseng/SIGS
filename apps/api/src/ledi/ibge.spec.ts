import { assertIbgeCode, resolveCodigoIbgeMunicipio } from './ibge';

describe('IBGE município', () => {
  it('aceita 7 dígitos e rejeita inválido', () => {
    expect(assertIbgeCode('3516200')).toBe('3516200');
    expect(assertIbgeCode('35.162-00')).toBe('3516200');
    expect(() => assertIbgeCode('35162')).toThrow(/7 dígitos/);
  });

  it('resolve facility antes do env', () => {
    const prev = process.env.SIGS_IBGE_MUNICIPIO;
    process.env.SIGS_IBGE_MUNICIPIO = '3550308';
    expect(resolveCodigoIbgeMunicipio('3516200')).toBe('3516200');
    expect(resolveCodigoIbgeMunicipio(null)).toBe('3550308');
    process.env.SIGS_IBGE_MUNICIPIO = prev;
  });
});
