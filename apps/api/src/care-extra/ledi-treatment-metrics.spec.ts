import {
  buildTreatmentSnapshot,
  countRegistrosXml,
  mergeTreatmentProgress,
} from './ledi-treatment-metrics';

describe('ledi-treatment-metrics', () => {
  it('conta atendimentos no bloco odonto', () => {
    const xml = `<atendimentosOdontologicos>
      <FichaAtendimentoOdontologicoChild><cnsCidadao>1</cnsCidadao></FichaAtendimentoOdontologicoChild>
      <FichaAtendimentoOdontologicoChild><cnsCidadao>2</cnsCidadao></FichaAtendimentoOdontologicoChild>
    </atendimentosOdontologicos>`;
    expect(countRegistrosXml(xml)).toBe(2);
  });

  it('classifica buckets e preserva baseline', () => {
    const items = [
      {
        findingsJson: JSON.stringify([{ severity: 'BLOCKER', code: 'A' }]),
        previneJson: null,
        currentXml: '<x/>',
      },
      {
        findingsJson: JSON.stringify([{ severity: 'MONEY_RISK', code: 'B' }]),
        previneJson: JSON.stringify({ summary: { moneyRisks: 1, qualityWarns: 0, infos: 0 } }),
        currentXml: '<x/>',
      },
      {
        findingsJson: JSON.stringify([{ severity: 'QUALITY_WARN', code: 'C' }]),
        previneJson: JSON.stringify({ summary: { moneyRisks: 0, qualityWarns: 1, infos: 0 } }),
        currentXml: '<x/>',
      },
      {
        findingsJson: '[]',
        previneJson: JSON.stringify({ summary: { moneyRisks: 0, qualityWarns: 0, infos: 0 } }),
        currentXml: '<x/>',
      },
    ];
    const snap = buildTreatmentSnapshot(items);
    expect(snap.bloqueioEnvio).toBe(1);
    expect(snap.riscoFaturamento).toBe(1);
    expect(snap.indicadores).toBe(1);
    expect(snap.ideais).toBe(1);

    const fixed = [
      items[0],
      {
        findingsJson: '[]',
        previneJson: JSON.stringify({ summary: { moneyRisks: 0, qualityWarns: 0, infos: 0 } }),
        currentXml: '<x/>',
      },
      items[2],
      items[3],
    ];
    const progress = mergeTreatmentProgress(
      { baseline: snap, current: snap, fichasCorrigidasAcumulado: 0, ultimaCorrecaoQtd: 0, ultimaCorrecaoEm: null },
      buildTreatmentSnapshot(fixed),
      { touchedDelta: 1 },
    );
    expect(progress.baseline.bloqueioEnvio).toBe(1);
    expect(progress.current.bloqueioEnvio).toBe(1);
    expect(progress.current.riscoFaturamento).toBe(0);
    expect(progress.fichasCorrigidasAcumulado).toBe(1);
  });
});
