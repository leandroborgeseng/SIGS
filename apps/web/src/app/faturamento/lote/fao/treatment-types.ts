export type TreatmentSnapshot = {
  fichas: number;
  registros: number;
  bloqueioEnvio: number;
  riscoFaturamento: number;
  indicadores: number;
  ideais: number;
  alertasBloqueio: number;
  alertasRisco: number;
  alertasIndicadores: number;
};

export type TreatmentProgress = {
  baseline: TreatmentSnapshot;
  current: TreatmentSnapshot;
  fichasCorrigidasAcumulado: number;
  ultimaCorrecaoQtd: number;
  ultimaCorrecaoEm: string | null;
};
