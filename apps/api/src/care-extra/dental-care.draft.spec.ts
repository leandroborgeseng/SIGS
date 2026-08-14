/**
 * Coerção do careJson clínico odonto (ciclo, faces, encaminhamento).
 */
import {
  defaultDentalCareDraft,
  DENTAL_REFERRAL_SPECIALTIES,
} from './dental-care.draft';

describe('defaultDentalCareDraft', () => {
  it('aceita ciclo de tratamento e limpa inválido', () => {
    const ok = defaultDentalCareDraft({
      treatment: {
        id: 'tr-1',
        startedAt: '2026-08-14T12:00:00.000Z',
        status: 'OPEN',
      },
    });
    expect(ok.treatment?.id).toBe('tr-1');
    expect(ok.treatment?.status).toBe('OPEN');

    const bad = defaultDentalCareDraft({
      treatment: { id: '', startedAt: '', status: 'OPEN' } as never,
    });
    expect(bad.treatment).toBeNull();
  });

  it('normaliza faces e toothNotes FDI', () => {
    const care = defaultDentalCareDraft({
      odontogramFaces: {
        '11': { o: 'am', X: 'RE' },
        '99': { O: 'AM' },
      } as never,
      toothNotes: { '11': 'obs', 'x': 'skip' } as never,
    });
    expect(care.odontogramFaces?.['11']?.O).toBe('AM');
    expect(care.odontogramFaces?.['11']?.X).toBe('RE');
    expect(care.odontogramFaces?.['99']).toBeUndefined();
    expect(care.toothNotes).toEqual({ '11': 'obs' });
  });

  it('mantém catálogo de especialidades de encaminhamento', () => {
    expect(DENTAL_REFERRAL_SPECIALTIES.some((s) => s.id === 'ENDODONTIA')).toBe(true);
    const care = defaultDentalCareDraft({
      referrals: [
        {
          id: 'r1',
          specialty: 'ENDODONTIA',
          justification: 'Dor',
          createdAt: '2026-08-14T12:00:00.000Z',
        },
        { id: '', specialty: '', justification: '', createdAt: '' },
      ],
    });
    expect(care.referrals).toHaveLength(1);
    expect(care.referrals?.[0].specialty).toBe('ENDODONTIA');
  });
});
