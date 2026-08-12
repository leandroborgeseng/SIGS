import {
  resolveAdModalidade,
  resolveAtividadeColetiva,
  resolveConduta,
  resolveCondutaOdonto,
  resolveCondutas,
  resolveLocalAtendimento,
  resolveSexo,
  resolveTipoAtendimento,
  resolveTurno,
} from './db-enums';

describe('LEDI db-enums', () => {
  it('resolve turno por alias UI', () => {
    expect(resolveTurno('MANHA')?.id).toBe(1);
    expect(resolveTurno('MORNING')?.id).toBe(1);
    expect(resolveTurno(2)?.code).toBe('TARDE');
  });

  it('resolve ALTA → id 9 (Alta do episódio)', () => {
    expect(resolveConduta('ALTA')).toEqual({
      id: 9,
      code: 'ALTA',
      label: 'Alta do episódio',
    });
  });

  it('resolve lista de condutas', () => {
    const list = resolveCondutas(['ALTA', 'RETORNO']);
    expect(list.map((c) => c.id)).toEqual([9, 1]);
  });

  it('resolve local UBS e sexo F', () => {
    expect(resolveLocalAtendimento('UBS')?.id).toBe(1);
    expect(resolveSexo('FEMALE')?.id).toBe(1);
    expect(resolveSexo('M')?.id).toBe(0);
  });

  it('resolve CONSULTA → consulta agendada (2)', () => {
    expect(resolveTipoAtendimento('CONSULTA')?.id).toBe(2);
  });

  it('rejeita código desconhecido', () => {
    expect(() => resolveConduta('XYZ_INVALIDO')).toThrow(/conduta inválido/);
  });

  it('resolve ALTA odonto → 17 e AD1 → 1', () => {
    expect(resolveCondutaOdonto('ALTA').id).toBe(17);
    expect(resolveAdModalidade('AD1')?.id).toBe(1);
    expect(resolveAtividadeColetiva('EDUCACAO_SAUDE')?.id).toBe(4);
  });
});
