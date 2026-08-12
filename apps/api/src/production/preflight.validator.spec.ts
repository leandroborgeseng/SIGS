import { buildPreflightReport, validateBatch } from './preflight.validator';

describe('preflight.validator', () => {
  it('bloqueia atendimento sem conduta e sem identificação', () => {
    const report = validateBatch({
      id: 'b1',
      kind: 'individual_encounter',
      status: 'ready',
      createdAt: '2026-08-10T12:00:00Z',
      payload: {
        uuidFicha: 'u1',
        headerTransport: { cnes: '1234567' },
        atendimentosIndividuais: [
          {
            condutas: [],
            dataNascimento: '1990-01-01',
            sexo: 'F',
          },
        ],
      },
    });
    expect(report.blockers).toBeGreaterThan(0);
    expect(report.findings.some((f) => f.code === 'OUTCOMES_MISSING')).toBe(true);
    expect(report.findings.some((f) => f.code === 'PATIENT_ID_MISSING')).toBe(true);
    expect(report.canSendAlone).toBe(false);
  });

  it('marca risco financeiro quando CBO e SIGTAP faltam', () => {
    const report = validateBatch(
      {
        id: 'b2',
        kind: 'individual_encounter',
        status: 'ready',
        createdAt: '2026-08-10T12:00:00Z',
        payload: {
          uuidFicha: 'u2',
          headerTransport: { cnes: '1234567', profissionalCNS: '898001234567890' },
          atendimentosIndividuais: [
            {
              cpfCidadao: '12345678901',
              condutas: ['ALTA'],
              problemaCondicaoAvaliada: { ciaps: ['A98'], cid10: [] },
            },
          ],
        },
      },
      { sigtapKnown: { '0301010064': false } },
    );
    expect(report.findings.some((f) => f.code === 'CBO_MISSING')).toBe(true);
    expect(report.findings.some((f) => f.code === 'SIGTAP_UNKNOWN')).toBe(true);
    expect(report.moneyRisks).toBeGreaterThan(0);
  });

  it('agrega canSend=false quando há blockers', () => {
    const agg = buildPreflightReport(
      [
        {
          id: 'b1',
          kind: 'collective_activity',
          status: 'ready',
          createdAt: '2026-08-10T12:00:00Z',
          payload: {
            uuidFicha: 'u',
            headerTransport: { cnes: '1234567' },
            fichaAtividadeColetivaTransport: { numParticipantes: 0 },
          },
        },
      ],
      { statuses: ['ready'] },
    );
    expect(agg.totals.canSend).toBe(false);
    expect(agg.summary.sendBlockers.length).toBeGreaterThan(0);
    expect(agg.checklist.some((c) => c.id === 'no_blockers' && !c.ok)).toBe(true);
  });

  it('permite envio quando estrutura mínima ok', () => {
    const agg = buildPreflightReport(
      [
        {
          id: 'b1',
          kind: 'individual_encounter',
          status: 'ready',
          createdAt: '2026-08-10T12:00:00Z',
          payload: {
            uuidFicha: 'u',
            headerTransport: {
              cnes: '1234567',
              profissionalCNS: '898001234567890',
              cboCodigo_2002: '225125',
              ine: '0000123456',
              codigoIbgeMunicipio: '3516200',
            },
            atendimentosIndividuais: [
              {
                cpfCidadao: '12345678901',
                condutas: ['ALTA'],
                turno: 'MANHA',
                localDeAtendimento: 'UBS',
                problemaCondicaoAvaliada: { ciaps: ['A98'], cid10: ['I10'] },
              },
            ],
          },
        },
      ],
      { statuses: ['ready'], sigtapKnown: { '0301010064': true } },
    );
    expect(agg.totals.blockers).toBe(0);
    expect(agg.totals.canSend).toBe(true);
  });
});
