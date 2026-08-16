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

  it('FAO omite procedimentos planejados (done=false)', () => {
    const p = buildDentalLediPayload({
      uuidFicha: 'd-2',
      lotacao,
      startedAt: new Date('2026-08-11T10:00:00Z'),
      finishedAt: new Date('2026-08-11T10:30:00Z'),
      patient: {
        cpf: '52998224725',
        cns: null,
        birthDate: new Date('1990-01-01'),
        sex: 'F',
      },
      outcomes: ['ALTA'],
      vigilanciaSaudeBucal: [1],
      problemasCondicoes: [{ ciap: 'D82' }],
      procedures: [
        { code: '0101020066', label: 'Selante', tooth: '16', done: false },
        { code: '0101020010', label: 'Consulta odonto', done: true },
      ],
    });
    expect(
      p.atendimentosOdontologicos[0].procedimentosRealizados.map((x) => x.coMsProcedimento),
    ).toEqual(['0101020010']);
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
    expect(p.atendimentosDomiciliares).toHaveLength(1);
    expect(p.atendimentosDomiciliares[0].atencaoDomiciliarModalidade).toBe(2);
    expect(p.atendimentosDomiciliares[0].condutaDesfecho).toBe(1);
    expect(p.atendimentosDomiciliares[0].stCidadaoNaoPossuiCpf).toBe(true);
    expect(p.atendimentosDomiciliares[0].tipoAtendimento).toBe(7);
    expect(p.fichaAdTransport.modalidade).toBe('AD2');
  });

  it('AD multi-child emite N atendimentosDomiciliares + condições', () => {
    const p = buildHomeCareLediPayload({
      uuidFicha: 'ad-multi',
      lotacao,
      visitedAt: new Date('2026-08-16T11:00:00Z'),
      children: [
        {
          patient: {
            cpf: '52998224725',
            cns: null,
            birthDate: new Date('1940-01-01'),
            sex: 'F',
          },
          careType: 'AD1',
          shift: 'MANHA',
          procedures: ['0101040024'],
          desfecho: 'PERMANENCIA',
          condicoesAvaliadas: [1, 3],
          problemasCondicoes: [{ ciap: 'A98' }],
        },
        {
          patient: {
            cpf: null,
            cns: '898003333333333',
            birthDate: new Date('1955-06-01'),
            sex: 'M',
          },
          careType: 'AD3',
          shift: 'TARDE',
          encounterType: 'ATENDIMENTO_NAO_PROGRAMADO',
          procedures: ['0101040024', 'CURATIVO'],
          desfecho: 'ALTA',
        },
      ],
    });
    expect(p.atendimentosDomiciliares).toHaveLength(2);
    expect(p.atendimentosDomiciliares[0].atencaoDomiciliarModalidade).toBe(1);
    expect(p.atendimentosDomiciliares[0].condicoesAvaliadas).toEqual([1, 3]);
    expect(p.atendimentosDomiciliares[0].ciap).toBe('A98');
    expect(p.atendimentosDomiciliares[0].stCidadaoNaoPossuiCpf).toBe(false);
    expect(p.atendimentosDomiciliares[1].atencaoDomiciliarModalidade).toBe(3);
    expect(p.atendimentosDomiciliares[1].tipoAtendimento).toBe(8);
    expect(p.fichaAdTransport.atencaoDomiciliarModalidade).toBe(1);
  });

  it('AD normaliza cid10 → cid no problema', () => {
    const p = buildHomeCareLediPayload({
      uuidFicha: 'ad-cid10',
      lotacao,
      visitedAt: new Date('2026-08-16T11:00:00Z'),
      patient: {
        cpf: '52998224725',
        cns: null,
        birthDate: new Date('1940-01-01'),
        sex: 'F',
      },
      careType: 'AD1',
      shift: 'MANHA',
      procedures: ['0101040024'],
      problemasCondicoes: [{ ciap: 'T90', cid10: 'I10' }],
    });
    expect(p.atendimentosDomiciliares[0].ciap).toBe('T90');
    expect(p.atendimentosDomiciliares[0].cid).toBe('I10');
    expect(p.atendimentosDomiciliares[0].problemasCondicoes).toEqual([{ ciap: 'T90', cid: 'I10' }]);
  });

  it('AD rejeita zero children', () => {
    expect(() =>
      buildHomeCareLediPayload({
        uuidFicha: 'ad-0',
        lotacao,
        visitedAt: new Date(),
        children: [],
      }),
    ).toThrow(/ao menos 1/);
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
