import { streamToInternalApi } from '@/lib/stream-api-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Pipe multipart XML → Nest. Não usa o rewrite do Next (clone/truncate). */
export async function POST(request: Request) {
  return streamToInternalApi(request);
}
