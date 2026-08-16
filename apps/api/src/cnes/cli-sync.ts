/**
 * CLI: npx ts-node --transpile-only src/cnes/cli-sync.ts --ibge=3516200 --source=snapshot
 */
import { PrismaClient } from '@prisma/client';
import { assertIbgeCode } from '../ledi/ibge';
import { fetchLiveCnesSnapshot } from './cnes.fetch';
import { loadCnesSnapshot } from './cnes.loader';
import { loadBundledSnapshot } from './cnes.snapshot';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const ibge = assertIbgeCode(arg('ibge') || process.env.MUNICIPIO_IBGE || '3516200') || '3516200';
  const source = (arg('source') || 'auto') as 'live' | 'snapshot' | 'auto';
  const activeOnly = flag('activeOnly') || arg('activeOnly') === '1';

  const prisma = new PrismaClient();
  try {
    let result;
    if (source === 'snapshot') {
      const { snapshot, path } = loadBundledSnapshot(ibge);
      result = await loadCnesSnapshot(prisma, snapshot, {
        activeOnly,
        source: 'snapshot',
        snapshotPath: path,
      });
    } else if (source === 'live') {
      const snapshot = await fetchLiveCnesSnapshot(ibge);
      result = await loadCnesSnapshot(prisma, snapshot, { activeOnly, source: 'live' });
    } else {
      try {
        const snapshot = await fetchLiveCnesSnapshot(ibge);
        result = await loadCnesSnapshot(prisma, snapshot, { activeOnly, source: 'live' });
      } catch (err) {
        console.warn('live falhou:', (err as Error).message, '→ snapshot');
        const { snapshot, path } = loadBundledSnapshot(ibge);
        result = await loadCnesSnapshot(prisma, snapshot, {
          activeOnly,
          source: 'snapshot',
          snapshotPath: path,
        });
      }
    }
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
