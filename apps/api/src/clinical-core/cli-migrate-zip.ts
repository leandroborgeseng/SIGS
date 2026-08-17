/**
 * CLI: npm run migrate:ledi-zip -- --file=lote.zip [--persist] [--force]
 * Default = dry-run (não grava Paciente Mestre).
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ClinicalCoreService } from './clinical-core.service';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const file = arg('file') || process.env.LEDI_MIGRATE_ZIP;
  if (!file) {
    console.error(
      JSON.stringify(
        {
          error: 'Informe --file=caminho.zip',
          hint: 'npm run migrate:ledi-zip -- --file=data/ledi/lote.zip  (dry-run)\n       npm run migrate:ledi-zip -- --file=... --persist',
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }
  const abs = resolve(file);
  if (!existsSync(abs)) {
    console.error(JSON.stringify({ error: `Arquivo não encontrado: ${abs}` }));
    process.exit(2);
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const core = app.get(ClinicalCoreService);
    const buf = readFileSync(abs);
    const result = await core.migrateZipBuffer(buf, {
      dryRun: !flag('persist'),
      force: flag('force'),
      maxFiles: Number(arg('maxFiles') || 500),
    });
    console.log(JSON.stringify({ file: abs, ...result }, null, 2));
    if (result.rejected && !result.ok) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
