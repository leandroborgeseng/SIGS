/**
 * CLI offline: npm run sync:sigtap -- [--file=...] [--competencia=YYYYMM] [--seed]
 *
 * Coloque o ZIP/TXT oficial em data/sigtap/ (não depende do site DATASUS).
 */
import { PrismaClient } from '@prisma/client';
import { discoverDefaultSigtapFile, loadSigtapLocalFile, resolveSigtapDataDir } from './local-file.loader';
import { parseTbProcedimentoText } from './ms-procedimento.parser';
import { SIGTAP_SEED, SIGTAP_SEED_COMPETENCIA } from './seed';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function ensureSeed(prisma: PrismaClient, force: boolean) {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const item of SIGTAP_SEED) {
    const existing = await prisma.sigtapProcedure.findUnique({ where: { code: item.code } });
    if (!existing) {
      await prisma.sigtapProcedure.create({
        data: {
          code: item.code,
          name: item.name,
          complex: item.complex,
          groupCode: item.groupCode,
          groupName: item.groupName,
          active: true,
          source: 'seed',
          competencia: SIGTAP_SEED_COMPETENCIA,
        },
      });
      created += 1;
      continue;
    }
    if (existing.source !== 'seed') {
      skipped += 1;
      continue;
    }
    if (force || existing.name !== item.name) {
      await prisma.sigtapProcedure.update({
        where: { code: item.code },
        data: {
          name: item.name,
          complex: item.complex,
          groupCode: item.groupCode,
          groupName: item.groupName,
          active: true,
          competencia: SIGTAP_SEED_COMPETENCIA,
          source: 'seed',
        },
      });
      updated += 1;
    } else {
      skipped += 1;
    }
  }
  const count = await prisma.sigtapProcedure.count();
  return { mode: 'seed' as const, created, updated, skipped, count, seedSize: SIGTAP_SEED.length };
}

async function upsertMsRows(
  prisma: PrismaClient,
  rows: Array<{
    code: string;
    name: string;
    groupCode: string;
    groupName?: string;
    complex?: string;
    competencia: string;
  }>,
  competencia: string,
  source: string,
) {
  let upserted = 0;
  for (const item of rows) {
    await prisma.sigtapProcedure.upsert({
      where: { code: item.code },
      create: {
        code: item.code,
        name: item.name,
        groupCode: item.groupCode,
        groupName: item.groupName,
        complex: item.complex,
        active: true,
        source,
        competencia: item.competencia || competencia,
      },
      update: {
        name: item.name,
        groupCode: item.groupCode,
        groupName: item.groupName,
        complex: item.complex,
        active: true,
        source,
        competencia: item.competencia || competencia,
      },
    });
    upserted += 1;
  }
  return upserted;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    if (flag('seed') && !arg('file') && !flag('auto')) {
      const result = await ensureSeed(prisma, flag('force'));
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    const file =
      arg('file') ||
      process.env.SIGTAP_FILE ||
      discoverDefaultSigtapFile(arg('dir') || resolveSigtapDataDir() || undefined);

    if (!file) {
      console.error(
        JSON.stringify(
          {
            error: 'Nenhum arquivo em data/sigtap/',
            hint: 'Coloque TabelaUnificada_*.zip ou TB_PROCEDIMENTO.txt em data/sigtap/ e rode de novo. Ou: npm run sync:sigtap -- --seed',
            dataDir: resolveSigtapDataDir(),
          },
          null,
          2,
        ),
      );
      process.exit(2);
    }

    const competenciaArg = arg('competencia');
    const loaded = await loadSigtapLocalFile(file, { competenciaFallback: competenciaArg });
    const competencia =
      competenciaArg ||
      loaded.detectedCompetencia ||
      new Date().toISOString().slice(0, 7).replace('-', '');

    let upserted = 0;
    let skipped = 0;
    let source = 'ms';

    if (loaded.kind === 'json_stub' && loaded.json) {
      source = 'import';
      const items = loaded.json.items.map((it) => ({
        code: String(it.code || '').replace(/\D/g, ''),
        name: String(it.name || ''),
        groupCode: String(it.groupCode || '').slice(0, 2) || undefined,
        groupName: it.groupName ? String(it.groupName) : undefined,
        complex: it.complex ? String(it.complex) : undefined,
        competencia: String(loaded.json!.competencia || competencia),
      }));
      upserted = await upsertMsRows(
        prisma,
        items
          .filter((i) => i.code.length >= 9 && i.name)
          .map((i) => ({
            code: i.code,
            name: i.name,
            groupCode: i.groupCode || i.code.slice(0, 2),
            groupName: i.groupName,
            complex: i.complex,
            competencia: i.competencia,
          })),
        competencia,
        source,
      );
    } else if (loaded.kind === 'csv' && loaded.csvRows) {
      source = 'import';
      upserted = await upsertMsRows(prisma, loaded.csvRows, competencia, source);
    } else if (loaded.content) {
      const parsed = parseTbProcedimentoText(loaded.content, {
        competenciaFallback: competencia,
        maxRows: Number(arg('maxRows') || 100_000),
      });
      skipped = parsed.skipped;
      upserted = await upsertMsRows(prisma, parsed.rows, competencia, 'ms');
      source = 'ms';
    }

    // Seed complementar (não sobrescreve ms/import)
    const seedResult = await ensureSeed(prisma, false);
    const count = await prisma.sigtapProcedure.count();

    console.log(
      JSON.stringify(
        {
          mode: 'file',
          file,
          kind: loaded.kind,
          source,
          upserted,
          skipped,
          competencia,
          detectedCompetencia: loaded.detectedCompetencia,
          seed: seedResult,
          count,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
