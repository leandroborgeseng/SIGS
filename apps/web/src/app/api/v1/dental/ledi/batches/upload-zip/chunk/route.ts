import { streamToInternalApi } from '@/lib/stream-api-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Pipe chunk octet-stream → Nest. Não usa o rewrite do Next (clone/truncate). */
async function pipe(request: Request) {
  return streamToInternalApi(request);
}

export const PUT = pipe;
export const POST = pipe;
