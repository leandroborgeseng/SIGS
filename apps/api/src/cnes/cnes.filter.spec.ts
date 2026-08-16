import {
  applyGestaoFilter,
  isMunicipalPrefeituraNetwork,
  parseGestaoMode,
} from './cnes.filter';
import type { CnesSnapshot } from './cnes.types';

const snapshot: CnesSnapshot = {
  meta: { ibgeCode: '3516200' },
  establishments: [
    {
      cnes: '9647198',
      name: 'UBS SANTA CLARA',
      typeId: '2',
      active: true,
      ibgeCode: '3516200',
      naturezaJuridica: '1244',
      tipoGestao: 'M',
      esferaAdministrativa: 'MUNICIPAL',
      razaoSocial: 'PREFEITURA MUNICIPAL DE FRANCA',
    },
    {
      cnes: '9644687',
      name: 'CLINICA PARTICULAR',
      typeId: '22',
      active: true,
      ibgeCode: '3516200',
      naturezaJuridica: '2062',
      tipoGestao: 'M',
      esferaAdministrativa: 'MUNICIPAL',
      razaoSocial: 'TALISMA LTDA',
    },
    {
      cnes: '6669727',
      name: 'AME FRANCA',
      typeId: '36',
      active: true,
      ibgeCode: '3516200',
      naturezaJuridica: '1023',
      tipoGestao: 'E',
      esferaAdministrativa: 'ESTADUAL',
      razaoSocial: 'ESTADO DE SAO PAULO',
    },
  ],
  teams: [
    { cnes: '9647198', ine: '0001667653', name: 'eSF', teamTypeId: '70' },
    { cnes: '9644687', ine: '0009999999', name: 'equipe particular', teamTypeId: '70' },
  ],
};

describe('cnes.filter', () => {
  it('parseGestaoMode default municipal', () => {
    expect(parseGestaoMode()).toBe('municipal');
    expect(parseGestaoMode('todos')).toBe('todos');
    expect(parseGestaoMode(undefined, true)).toBe('municipal');
    expect(parseGestaoMode(undefined, false)).toBe('todos');
  });

  it('isMunicipalPrefeituraNetwork usa natureza 1244 (não só tipo_gestao=M)', () => {
    expect(isMunicipalPrefeituraNetwork(snapshot.establishments[0])).toBe(true);
    expect(isMunicipalPrefeituraNetwork(snapshot.establishments[1])).toBe(false);
    expect(isMunicipalPrefeituraNetwork(snapshot.establishments[2])).toBe(false);
  });

  it('applyGestaoFilter municipal reduz cidade → Prefeitura', () => {
    const { snapshot: filtered, filter } = applyGestaoFilter(snapshot, 'municipal');
    expect(filter.before.establishments).toBe(3);
    expect(filter.after.establishments).toBe(1);
    expect(filtered.establishments.map((e) => e.cnes)).toEqual(['9647198']);
    expect(filtered.teams).toHaveLength(1);
    expect(filtered.teams[0].cnes).toBe('9647198');
  });

  it('applyGestaoFilter todos mantém cidade', () => {
    const { snapshot: filtered, filter } = applyGestaoFilter(snapshot, 'todos');
    expect(filter.after.establishments).toBe(3);
    expect(filtered.teams).toHaveLength(2);
  });
});
