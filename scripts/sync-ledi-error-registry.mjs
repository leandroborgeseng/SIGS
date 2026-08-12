#!/usr/bin/env node
/**
 * Mantém o espelho web do registry LEDI igual ao da API.
 * Uso: node scripts/sync-ledi-error-registry.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiFile = path.join(root, 'apps/api/src/care-extra/ledi-error-registry.ts');
const webFile = path.join(root, 'apps/web/src/lib/ledi/error-registry.ts');

let src = fs.readFileSync(apiFile, 'utf8');
src = src.replace(
  'Fonte de verdade P0 — API e UI devem cobrir 100% destes códigos.',
  'Espelho de apps/api/src/care-extra/ledi-error-registry.ts — o teste CI exige paridade.',
);
fs.mkdirSync(path.dirname(webFile), { recursive: true });
fs.writeFileSync(webFile, src);
console.log('Synced', path.relative(root, apiFile), '→', path.relative(root, webFile));
