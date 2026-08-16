/** BPA stub v0 — formato interno versionado (não é layout DATASUS oficial). */

export type ProductionBatchLike = {
  id: string;
  kind: string;
  status: string;
  createdAt: Date | string;
  payloadJson?: string;
  payload?: Record<string, unknown>;
};

export type BpaStubLine = {
  competencia: string;
  cnes: string;
  procedimento: string;
  quantidade: number;
  cbo?: string;
  cnsProfissional?: string;
  cnsPaciente?: string;
  sexo?: string;
  sourceBatchId: string;
  sourceKind: string;
  label: string;
};

export type BpaStubExport = {
  format: 'bpa-stub-v0';
  competencia: string;
  generatedAt: string;
  rfIds: string[];
  totalLines: number;
  totalQuantity: number;
  lines: BpaStubLine[];
  csv: string;
};

const KIND_PROC: Record<string, { code: string; label: string }> = {
  individual_encounter: { code: '0301010064', label: 'Consulta médica APS (stub)' },
  vaccination: { code: '0301010030', label: 'Aplicação de imunobiológico (stub)' },
  dental_encounter: { code: '0101020010', label: 'Consulta odontológica APS (stub)' },
  home_care: { code: '0101040024', label: 'Atendimento domiciliar APS (stub)' },
  collective_activity: { code: '0101050011', label: 'Atividade coletiva / educação em saúde (stub)' },
};

function competenciaFrom(d: Date | string) {
  const dt = typeof d === 'string' ? new Date(d) : d;
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
}

function payloadOf(b: ProductionBatchLike): Record<string, unknown> {
  if (b.payload) return b.payload;
  try {
    return JSON.parse(b.payloadJson || '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

function pickCnes(p: Record<string, unknown>): string {
  const header = p.headerTransport as { cnes?: string } | undefined;
  return String(header?.cnes || p.facilityCnes || p.cnes || '0000000');
}

export function buildBpaStub(
  batches: ProductionBatchLike[],
  opts?: { competencia?: string; statuses?: string[] },
): BpaStubExport {
  const allowed = new Set(opts?.statuses || ['ready', 'sent']);
  const lines: BpaStubLine[] = [];

  for (const b of batches) {
    if (!allowed.has(b.status)) continue;
    const map = KIND_PROC[b.kind];
    if (!map) continue;
    const p = payloadOf(b);
    const comp = opts?.competencia || competenciaFrom(b.createdAt);
    const header = p.headerTransport as
      | {
          cnesProfissional?: string;
          cnsProfissional?: string;
          profissionalCNS?: string;
          cboCodigo_2002?: string;
          lotacaoFormPrincipal?: {
            profissionalCNS?: string;
            cboCodigo_2002?: string;
            cnes?: string;
          };
        }
      | undefined;
    const lotacao = header?.lotacaoFormPrincipal;
    const child = (p.fichaAtendimentoIndividualTransport ||
      p.fichaVacinacaoTransport ||
      p.fichaOdontoTransport ||
      p.fichaAdTransport ||
      p.fichaAtividadeColetivaTransport ||
      (Array.isArray(p.atendimentosIndividuais) ? p.atendimentosIndividuais[0] : undefined) ||
      (Array.isArray(p.vacinacoesIndividuais) ? p.vacinacoesIndividuais[0] : undefined) ||
      {}) as Record<string, unknown>;

    const qty =
      b.kind === 'collective_activity'
        ? Math.max(1, Number(child.numParticipantes || p.participantCount || 1))
        : b.kind === 'home_care'
          ? Math.max(
              1,
              Array.isArray(p.atendimentosDomiciliares) ? p.atendimentosDomiciliares.length : 1,
            )
          : 1;

    lines.push({
      competencia: comp,
      cnes: pickCnes(p),
      procedimento: map.code,
      quantidade: qty,
      cbo: header?.cboCodigo_2002 || lotacao?.cboCodigo_2002 || (p.cbo as string | undefined),
      cnsProfissional:
        header?.profissionalCNS ||
        header?.cnsProfissional ||
        header?.cnesProfissional ||
        lotacao?.profissionalCNS ||
        (p.cnsProfissional as string | undefined),
      cnsPaciente: (child.cns as string | undefined) || (p.cnsPaciente as string | undefined),
      sexo: child.sexo != null ? String(child.sexo) : undefined,
      sourceBatchId: b.id,
      sourceKind: b.kind,
      label: map.label,
    });
  }

  const competencia =
    opts?.competencia || lines[0]?.competencia || competenciaFrom(new Date());

  const filtered = opts?.competencia
    ? lines.filter((l) => l.competencia === opts.competencia)
    : lines;

  const header = [
    'competencia',
    'cnes',
    'procedimento',
    'quantidade',
    'cbo',
    'cns_profissional',
    'cns_paciente',
    'sexo',
    'batch_id',
    'kind',
    'label',
  ];
  const csvRows = filtered.map((l) =>
    [
      l.competencia,
      l.cnes,
      l.procedimento,
      l.quantidade,
      l.cbo || '',
      l.cnsProfissional || '',
      l.cnsPaciente || '',
      l.sexo || '',
      l.sourceBatchId,
      l.sourceKind,
      l.label,
    ]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(','),
  );

  return {
    format: 'bpa-stub-v0',
    competencia,
    generatedAt: new Date().toISOString(),
    rfIds: ['RF-10.4', 'RF-9.2', 'RF-10.20'],
    totalLines: filtered.length,
    totalQuantity: filtered.reduce((s, l) => s + l.quantidade, 0),
    lines: filtered,
    csv: [header.join(','), ...csvRows].join('\n'),
  };
}
