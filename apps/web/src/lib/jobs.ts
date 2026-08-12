import { api } from './api';

export type JobStatus = {
  id: string;
  type: string;
  status: 'queued' | 'active' | 'completed' | 'failed' | 'dead' | string;
  progressPct: number;
  progressMessage?: string | null;
  result?: Record<string, unknown> | null;
  errorMessage?: string | null;
  resultObjectKey?: string | null;
};

/** Poll até completed/failed/dead ou timeout. */
export async function waitForJob(
  jobId: string,
  opts: { intervalMs?: number; timeoutMs?: number; onProgress?: (j: JobStatus) => void } = {},
): Promise<JobStatus> {
  const intervalMs = opts.intervalMs ?? 800;
  const timeoutMs = opts.timeoutMs ?? 10 * 60_000;
  const started = Date.now();
  for (;;) {
    const job = await api<JobStatus>(`/v1/jobs/${jobId}`);
    opts.onProgress?.(job);
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'dead') {
      return job;
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timeout aguardando job ${jobId} (status=${job.status})`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

export function isAsyncJobResponse(data: unknown): data is { async: true; jobId: string } {
  return (
    !!data &&
    typeof data === 'object' &&
    (data as { async?: boolean }).async === true &&
    typeof (data as { jobId?: unknown }).jobId === 'string'
  );
}
