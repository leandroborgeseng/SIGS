#!/usr/bin/env node
/**
 * Divide um ZIP LEDI (FAI/FAO/PROC) em pedaços ~4 MB achatados no Desktop.
 * Útil quando o Safari falha ao ler um ZIP ~13 MB (File API / fatias).
 *
 * NÃO grava conteúdo clínico no git — saída só no Desktop.
 *
 * Uso:
 *   node tools/split-ledi-zip.cjs
 *   node tools/split-ledi-zip.cjs /caminho/Lote-FAI.zip
 *   node tools/split-ledi-zip.cjs /caminho/Lote-FAI.zip --max-mb 4
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_MAX_MB = 4;

function resolveJszip() {
  const roots = [path.join(__dirname, '..'), path.join(__dirname, '../apps/api'), process.cwd()];
  return require(require.resolve('jszip', { paths: roots }));
}

function isJunk(name) {
  const n = String(name || '').replace(/\\/g, '/');
  if (!n || n.endsWith('/')) return true;
  if (n.startsWith('__MACOSX/') || n.includes('/__MACOSX/')) return true;
  const base = n.split('/').pop() || n;
  if (base.startsWith('._') || base.startsWith('.')) return true;
  if (base.toLowerCase() === '.ds_store') return true;
  return false;
}

function isXml(name) {
  if (isJunk(name)) return false;
  const base = String(name).replace(/\\/g, '/').split('/').pop() || name;
  return /\.xml$/i.test(base);
}

function parseArgs(argv) {
  let maxMb = DEFAULT_MAX_MB;
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--max-mb' && argv[i + 1]) {
      maxMb = Number(argv[++i]);
      continue;
    }
    if (/^--max-mb=/.test(a)) {
      maxMb = Number(a.split('=')[1]);
      continue;
    }
    if (a.startsWith('-')) {
      console.error('Opção desconhecida:', a);
      process.exit(1);
    }
    positional.push(a);
  }
  if (!Number.isFinite(maxMb) || maxMb < 0.5 || maxMb > 50) {
    console.error('--max-mb deve ser entre 0.5 e 50');
    process.exit(1);
  }
  return { src: positional[0], maxMb };
}

function findSource(explicit) {
  if (explicit) {
    if (!fs.existsSync(explicit)) {
      console.error('Não encontrado:', explicit);
      process.exit(1);
    }
    return path.resolve(explicit);
  }
  const home = os.homedir();
  const desktop = path.join(home, 'Desktop');
  const candidates = [];
  try {
    for (const name of fs.readdirSync(desktop)) {
      if (/\.zip$/i.test(name) && /fai|fao|proc|ledi|lote/i.test(name)) {
        candidates.push(path.join(desktop, name));
      }
    }
  } catch {
    /* ignore */
  }
  candidates.push(
    path.join(desktop, 'Lote-FAI.zip'),
    path.join(home, 'Downloads', 'Lote-FAI.zip'),
  );
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  console.error(
    'ZIP não encontrado. Passe o caminho:\n  node tools/split-ledi-zip.cjs /caminho/Lote-FAI.zip',
  );
  process.exit(1);
}

function baseOutName(srcPath) {
  const base = path.basename(srcPath, path.extname(srcPath)) || 'ledi-lote';
  return base.replace(/[^\w.\-]+/g, '_');
}

async function main() {
  const JSZip = resolveJszip();
  const { src: argSrc, maxMb } = parseArgs(process.argv.slice(2));
  const src = findSource(argSrc);
  const maxBytes = Math.floor(maxMb * 1024 * 1024);
  const destDir = path.join(os.homedir(), 'Desktop');
  const prefix = baseOutName(src);

  console.log('Lendo', src);
  const buf = fs.readFileSync(src);
  const zip = await JSZip.loadAsync(buf);
  const names = Object.keys(zip.files)
    .filter((n) => !zip.files[n].dir && isXml(n))
    .sort();
  console.log(names.length, 'XMLs; alvo ~' + maxMb + ' MB por pedaço (achatados)');

  if (!names.length) {
    console.error('Nenhum XML no ZIP.');
    process.exit(1);
  }

  const parts = [];
  let current = new JSZip();
  let currentBytes = 0;
  let partIndex = 1;
  let filesInPart = 0;

  async function flush() {
    if (filesInPart === 0) return;
    const outName = `${prefix}-parte${String(partIndex).padStart(2, '0')}.zip`;
    const outPath = path.join(destDir, outName);
    const outBuf = await current.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    fs.writeFileSync(outPath, outBuf);
    console.log(
      `  → ${outName} (${(outBuf.length / (1024 * 1024)).toFixed(2)} MB, ${filesInPart} XMLs)`,
    );
    parts.push(outPath);
    partIndex += 1;
    current = new JSZip();
    currentBytes = 0;
    filesInPart = 0;
  }

  for (const name of names) {
    const base = String(name).replace(/\\/g, '/').split('/').pop() || name;
    const entryBuf = await zip.files[name].async('nodebuffer');
    // Se um XML sozinho passa do limite, ainda assim vai sozinho num pedaço.
    if (filesInPart > 0 && currentBytes + entryBuf.length > maxBytes) {
      await flush();
    }
    current.file(base, entryBuf);
    currentBytes += entryBuf.length;
    filesInPart += 1;
  }
  await flush();

  console.log('');
  console.log(`${parts.length} pedaço(s) no Desktop. No Safari, envie um por vez (botão Escolher).`);
  console.log('Chrome/Edge costuma aceitar o ZIP original inteiro.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
