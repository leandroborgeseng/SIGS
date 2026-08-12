import { buildDentalLediPayload } from './ledi-dental.mapper';
import { buildHomeCareLediPayload } from './ledi-homecare.mapper';
import { buildCollectiveLediPayload } from './ledi-collective.mapper';

const lotacao = {
  profissionalCNS: '898001111111111',
  cboCodigo_2002: '223280',
  cnes: '9999999',
  ine: '0000000001',
};

describe('LEDI care-extra mappers v2', () => {
  it('odonto emite tiposEncamOdonto numéricos + lotação + vigilância', () => {
    const p = buildDentalLediPayload({
      uuidFicha: 'd-1',
      lotacao,
      startedAt: new Date('2026-08-11T10:00:00Z'),
      finishedAt: new Date('2026-08-11T10:30:00Z'),
      patient: {
        cpf: '52998224725',
        cns: null,
        birthDate: new Date('1990-01-01'),
        sex: 'F',
      },
      encounterType: 'CONSULTA',
      outcomes: ['ALTA'],
      vigilanciaSaudeBucal: [1],
      problemasCondicoes: [{ ciap: 'D82' }],
      procedures: [{ code: '0101020010', label: 'Consulta odonto' }],
    });
    expect(p.mapperVersion).toBe('ledi-dental-v2');
    expect(p.headerTransport.cboCodigo_2002).toBe('223280');
    expect(p.tpCdsOrigem).toBe(3);
    expect(p.atendimentosOdontologicos[0].tiposEncamOdonto).toEqual([17]);
    expect(p.atendimentosOdontologicos[0].tiposVigilanciaSaudeBucal).toEqual([1]);
    expect(p.atendimentosOdontologicos[0].problemasCondicoes).toEqual([{ ciap: 'D82' }]);
    expect(p.atendimentosOdontologicos[0].tiposConsultaOdonto).not.toContain(1);
    expect(p.fichaOdontoTransport.condutas).toEqual([17]);
  });

  it('AD emite modalidade id + desfecho', () => {
    const p = buildHomeCareLediPayload({
      uuidFicha: 'ad-1',
      lotacao,
      visitedAt: new Date('2026-08-11T11:00:00Z'),
      patient: {
        cpf: null,
        cns: '898003333333333',
        birthDate: new Date('1950-01-01'),
        sex: 'M',
      },
      careType: 'AD2',
      shift: 'TARDE',
      procedures: ['0101040024'],
      desfecho: 'ALTA',
    });
    expect(p.mapperVersion).toBe('ledi-homecare-v2');
    expect(p.atendimentosDomiciliares[0].atencaoDomiciliarModalidade).toBe(2);
    expect(p.atendimentosDomiciliares[0].condutaDesfecho).toBe(1);
    expect(p.fichaAdTransport.modalidade).toBe('AD2');
  });

  it('coletivo mapeia educação + tema saúde', () => {
    const p = buildCollectiveLediPayload({
      uuidFicha: 'c-1',
      lotacao,
      heldAt: new Date('2026-08-11T14:00:00Z'),
      activityType: 'EDUCACAO_SAUDE',
      theme: 'ALIMENTACAO',
      audience: 'COMUNIDADE',
      shift: 'MANHA',
      participantCount: 12,
      procedures: ['0101050011'],
    });
    expect(p.mapperVersion).toBe('ledi-collective-v2');
    expect(p.atividadeTipo).toBe(4);
    expect(p.temasParaSaude).toEqual([1]);
    expect(p.fichaAtividadeColetivaTransport.numParticipantes).toBe(12);
  });

  it('reunião usa temasParaReuniao', () => {
    const p = buildCollectiveLediPayload({
      uuidFicha: 'c-2',
      lotacao,
      heldAt: new Date('2026-08-11T15:00:00Z'),
      activityType: 'REUNIAO',
      theme: 'PLANEJAMENTO',
      audience: 'PROFISSIONAIS',
      participantCount: 5,
    });
    expect(p.atividadeTipo).toBe(1);
    expect(p.temasParaReuniao).toEqual([4]);
  });
});
