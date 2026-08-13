import { streamToInternalApi } from '@/lib/stream-api-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  return streamToInternalApi(request);
}
