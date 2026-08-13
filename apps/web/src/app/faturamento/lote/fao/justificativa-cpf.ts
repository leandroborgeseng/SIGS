/** Tabela oficial JustificativaNaoPossuiCpf (e-SUS / LEDI). */
export const JUSTIFICATIVA_NAO_POSSUI_CPF = [
  { code: 1, label: 'Documento perdido' },
  { code: 2, label: 'Paciente desacordado, sem documentos' },
  { code: 3, label: 'Recém-nascidos' },
  { code: 4, label: 'Indígenas sem CPF' },
  { code: 5, label: 'Pessoa em situação de rua sem documentos' },
  { code: 6, label: 'Recusa cultural ou religiosa' },
  { code: 7, label: 'Estrangeiro em trânsito (turista/visitante)' },
  { code: 8, label: 'Pessoa indocumentada' },
  { code: 9, label: 'Crianças sem documentação emitida' },
  { code: 10, label: 'Estrangeiro residente sem CPF' },
  { code: 11, label: 'Internação compulsória (saúde mental ou ordem judicial)' },
  { code: 12, label: 'População migrante/refugiada em regularização' },
  { code: 13, label: 'Situações de calamidade ou desastre' },
  { code: 99, label: 'Outra' },
] as const;
