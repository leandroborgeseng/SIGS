'use client';

import { Modal } from '@/components/ui/Modal';
import { jobProgressLabel, parseJobFichaProgress, type JobStatus } from '@/lib/jobs';

export type LediJobUi = {
  jobId: string;
  mode: 'apply' | 'dry-run' | 'import';
  job: JobStatus | null;
};

function titleFor(mode: LediJobUi['mode']) {
  if (mode === 'dry-run') return 'Simulando auto-correção';
  if (mode === 'import') return 'Analisando lote no servidor';
  return 'Corrigindo lote';
}

export function LediJobProgressPanel({
  job,
  mode,
  compact,
}: {
  job: JobStatus | null;
  mode: LediJobUi['mode'];
  compact?: boolean;
}) {
  const parsed = parseJobFichaProgress(job);
  const pct = job?.progressPct ?? (parsed ? Math.round((parsed.processed / parsed.total) * 100) : 0);
  const label = job ? jobProgressLabel(job) : 'Na fila…';
  const max = parsed?.total || 100;
  const value = parsed?.processed ?? pct;

  return (
    <div className={compact ? 'ledi-job-progress compact' : 'ledi-job-progress'}>
      <strong>{titleFor(mode)}</strong>
      <p style={{ margin: '6px 0 8px' }}>{label}</p>
      <progress value={value} max={max} style={{ width: '100%' }} />
      {parsed ? (
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
          Ficha {parsed.processed} de {parsed.total}
        </p>
      ) : null}
    </div>
  );
}

export function LediJobProgressModal({
  open,
  ui,
  onDismiss,
}: {
  open: boolean;
  ui: LediJobUi | null;
  onDismiss?: () => void;
}) {
  if (!ui) return null;
  const done = ui.job?.status === 'completed';
  const failed = ui.job?.status === 'failed' || ui.job?.status === 'dead';
  return (
    <Modal
      open={open}
      size="md"
      closeOnBackdrop={false}
      onClose={() => {
        if (done || failed) onDismiss?.();
      }}
      title={titleFor(ui.mode)}
      subtitle={done ? 'Concluído' : failed ? 'Falhou — o próximo clique retoma deste ponto' : 'Não feche esta aba'}
      footer={
        done || failed ? (
          <button type="button" className="btn btn-primary" onClick={() => onDismiss?.()}>
            {done ? 'Fechar' : 'Entendi'}
          </button>
        ) : undefined
      }
    >
      <LediJobProgressPanel job={ui.job} mode={ui.mode} />
      {failed && ui.job?.errorMessage ? (
        <p className="muted" style={{ marginTop: 10, color: 'var(--danger)' }}>
          {ui.job.errorMessage}
        </p>
      ) : null}
      {done ? (
        <p className="muted" style={{ marginTop: 10 }}>
          Ciclo encerrado. O resumo do lote já foi atualizado — não é preciso clicar de novo.
        </p>
      ) : null}
    </Modal>
  );
}
