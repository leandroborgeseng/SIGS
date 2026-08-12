#!/usr/bin/env node
/**
 * Upload de lote LEDI a partir do disco (Node lê o arquivo — sem I/O do browser).
 *
 * Uso:
 *   node tools/upload-ledi-lote.mjs ./fai.zip --tipo FAI
 *   node tools/upload-ledi-lote.mjs ./pasta-com-xmls --tipo FAO
 *
 * Env (opcional):
 *   SIGS_API=https://sigs-production.up.railway.app/api
 *   SIGS_EMAIL=admin@sigs.local
 *   SIGS_PASSWORD=admin123
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const API = (process.env.SIGS_API || 'https://sigs-production.up.railway.app/api').replace(/\/$/, '');
const EMAIL = process.env.SIGS_EMAIL || 'admin@sigs.local';
const PASSWORD = process.env.SIGS_PASSWORD || 'admin123';

function usage() {
  console.error(`Uso: node tools/upload-ledi-lote.mjs <arquivo.zip|pasta> --tipo FAO|FAI|PROCEDIMENTOS`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) usage();
  const target = args[0];
  const tipoIdx = args.indexOf('--tipo');
  const expectedTipo = (tipoIdx >= 0 ? args[tipoIdx + 1] : 'FAO') || 'FAO';
  if (!['FAO', 'FAI', 'PROCEDIMENTOS'].includes(expectedTipo)) usage();

  const abs = path.resolve(target);
  if (!fs.existsSync(abs)) {
    console.error('Não encontrado:', abs);
    process.exit(1);
  }

  console.log('Login…', API);
  const loginRes = await fetch(`${API}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const login = await loginRes.json();
  if (!loginRes.ok || !login.accessToken) {
    console.error('Login falhou', loginRes.status, login);
    process.exit(1);
  }
  const token = login.accessToken;

  let body;
  const name = path.basename(abs).replace(/\.zip$/i, '');

  if (fs.statSync(abs).isDirectory()) {
    const files = fs
      .readdirSync(abs)
      .filter((f) => f.toLowerCase().endsWith('.xml'))
      .map((f) => ({
        name: f,
        xml: fs.readFileSync(path.join(abs, f), 'utf8'),
      }));
    if (!files.length) {
      console.error('Pasta sem .xml');
      process.exit(1);
    }
    console.log(`Enviando ${files.length} XMLs (JSON)…`);
    body = { name, expectedTipo, files };
    const res = await fetch(`${API}/v1/dental/ledi/batches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('Falha', res.status, data);
      process.exit(1);
    }
    console.log('OK', {
      id: data.id,
      status: data.status,
      summary: data.summary,
    });
    return;
  }

  if (!/\.zip$/i.test(abs)) {
    console.error('Informe um .zip ou uma pasta');
    process.exit(1);
  }

  const buf = fs.readFileSync(abs);
  const zipBase64 = buf.toString('base64');
  console.log(`Enviando ZIP ${path.basename(abs)} (${Math.round(buf.length / 1024)} KB)…`);
  const res = await fetch(`${API}/v1/dental/ledi/batches/from-zip`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, expectedTipo, zipBase64 }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Falha', res.status, data);
    process.exit(1);
  }
  console.log('OK', {
    id: data.id,
    status: data.status,
    summary: data.summary,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
