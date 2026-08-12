import { buildBpaStub } from './bpa-stub.mapper';

describe('buildBpaStub', () => {
  it('gera linhas a partir de lotes ready', () => {
    const out = buildBpaStub([
      {
        id: 'b1',
        kind: 'individual_encounter',
        status: 'ready',
        createdAt: new Date('2026-08-10T12:00:00Z'),
        payload: {
          headerTransport: { cnes: '9999999', cnsProfissional: '898001111111111' },
          fichaAtendimentoIndividualTransport: { cns: '898003333333333', sexo: 'F' },
        },
      },
      {
        id: 'b2',
        kind: 'dental_encounter',
        status: 'ready',
        createdAt: new Date('2026-08-10T13:00:00Z'),
        payload: { facilityCnes: '9999999' },
      },
      {
        id: 'b4',
        kind: 'collective_activity',
        status: 'ready',
        createdAt: new Date('2026-08-10T15:00:00Z'),
        payload: {
          facilityCnes: '9999999',
          fichaAtividadeColetivaTransport: { numParticipantes: 12 },
        },
      },
      {
        id: 'b3',
        kind: 'unknown',
        status: 'ready',
        createdAt: new Date('2026-08-10T14:00:00Z'),
        payload: {},
      },
    ]);

    expect(out.format).toBe('bpa-stub-v0');
    expect(out.totalLines).toBe(3);
    expect(out.lines[0].procedimento).toBe('0301010064');
    expect(out.lines[1].procedimento).toBe('0101020010');
    expect(out.lines[2].procedimento).toBe('0101050011');
    expect(out.lines[2].quantidade).toBe(12);
    expect(out.csv).toContain('competencia');
    expect(out.rfIds).toContain('RF-10.4');
  });

  it('ignora draft', () => {
    const out = buildBpaStub([
      {
        id: 'b1',
        kind: 'vaccination',
        status: 'draft',
        createdAt: new Date(),
        payload: { facilityCnes: '1' },
      },
    ]);
    expect(out.totalLines).toBe(0);
  });
});
