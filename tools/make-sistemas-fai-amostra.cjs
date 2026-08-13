#!/usr/bin/env node
/**
 * Gera sistemas-fai-amostra.zip achatado (~200 XMLs FAI) no Desktop,
 * no mesmo formato de Arquivo.zip — para testar validação FAI sem mandar
 * os 8k XMLs de sistemas.zip pelo gateway.
 *
 * Não grava conteúdo clínico no git.
 *
 * Uso:
 *   node tools/make-sistemas-fai-amostra.cjs
 *   node tools/make-sistemas-fai-amostra.cjs /caminho/sistemas.zip
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const LIMIT = 200;
const OUT_NAME = 'sistemas-fai-amostra.zip';

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

function isFai(xml) {
  if (/<tipoDadoSerializado>\s*4\s*<\/tipoDadoSerializado>/i.test(xml)) return true;
  return /fichaAtendimentoIndividualMasterTransport/i.test(xml);
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
  const candidates = [
    path.join(home, 'Desktop', 'sistemas.zip'),
    path.join(home, 'Downloads', 'SIGS-Exemplos', 'sistemas.zip'),
    path.join(home, 'Downloads', 'sistemas.zip'),
    path.join(__dirname, '../tmp/ledi-upload/fai.zip'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  console.error('sistemas.zip não encontrado. Passe o caminho: node tools/make-sistemas-fai-amostra.cjs /caminho/sistemas.zip');
  process.exit(1);
}

async function main() {
  const JSZip = resolveJszip();
  const src = findSource(process.argv[2]);
  const destDir = path.join(os.homedir(), 'Desktop');
  const dest = path.join(destDir, OUT_NAME);
  console.log('Lendo', src);
  const buf = fs.readFileSync(src);
  const zip = await JSZip.loadAsync(buf);
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir && isXml(n));
  console.log(names.length, 'XMLs no ZIP');

  const out = new JSZip();
  let kept = 0;
  let skippedTipo = 0;
  const used = new Map();
  for (const name of names) {
    if (kept >= LIMIT) break;
    const xml = await zip.files[name].async('string');
    if (!xml || !xml.trim()) continue;
    if (!isFai(xml)) {
      skippedTipo += 1;
      continue;
    }
    const base = (name.replace(/\\/g, '/').split('/').pop() || name).slice(0, 240);
    const n = (used.get(base) || 0) + 1;
    used.set(base, n);
    const destName = n === 1 ? base : base.replace(/\.xml$/i, '') + `-${n}.xml`;
    out.file(destName, xml);
    kept += 1;
  }

  if (!kept) {
    console.error('Nenhum XML FAI (tipo 4) encontrado em', src);
    process.exit(1);
  }

  const packed = await out.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(dest, packed);
  console.log(
    `OK ${dest} (${(packed.length / 1024 / 1024).toFixed(2)} MB) — ${kept} XMLs FAI achatados` +
      (skippedTipo ? ` (ignorados ${skippedTipo} de outro tipo)` : ''),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
