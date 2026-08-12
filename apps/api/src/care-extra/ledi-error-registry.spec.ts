import * as fs from 'fs';
import * as path from 'path';
import {
  AUTO_FIXABLE_CODES,
} from './ledi-fao-xml.fixer';
import {
  LEDI_ERROR_REGISTRY,
  allLediErrorCodes,
  autoFixableCodes,
  coverageSummary,
} from './ledi-error-registry';

const CARE_EXTRA = path.join(__dirname);

/** Extrai literais code: 'FOO' / push(..., 'FOO', ...) dos validadores. */
function extractCodesFromSource(fileName: string): string[] {
  const src = fs.readFileSync(path.join(CARE_EXTRA, fileName), 'utf8');
  const codes = new Set<string>();
  for (const m of src.matchAll(/\bcode:\s*'([A-Z][A-Z0-9_]*)'/g)) codes.add(m[1]);
  for (const m of src.matchAll(/push\(\s*findings\s*,\s*'[A-Z_]+'\s*,\s*'([A-Z][A-Z0-9_]*)'/g)) {
    codes.add(m[1]);
  }
  // previne gaps: pushGap(..., 'PREVINE_...')
  for (const m of src.matchAll(/'((?:PREVINE_|[A-Z])[A-Z0-9_]*)'/g)) {
    if (
      m[1].startsWith('PREVINE_') ||
      m[1] === 'WRONG_FICHA_TIPO' ||
      LEDI_ERROR_REGISTRY[m[1]]
    ) {
      // too broad — only keep PREVINE_ from previne file below
    }
  }
  return [...codes];
}

function extractPrevineCodes(fileName: string): string[] {
  const src = fs.readFileSync(path.join(CARE_EXTRA, fileName), 'utf8');
  const codes = new Set<string>();
  // Literais de gap: 'PREVINE_B1_...' (não o nome do canal PREVINE_ESB_B1_B6)
  for (const m of src.matchAll(/'(PREVINE_(?:INE|CBO|PROBLEMAS|VIGILANCIA|B[1-6])_[A-Z0-9_]+)'/g)) {
    codes.add(m[1]);
  }
  for (const m of src.matchAll(/'(PREVINE_B4_NOT_IN_FAO)'/g)) codes.add(m[1]);
  return [...codes];
}

function extractPushCodes(fileName: string): string[] {
  const src = fs.readFileSync(path.join(CARE_EXTRA, fileName), 'utf8');
  const codes = new Set<string>();
  for (const m of src.matchAll(/push\(\s*findings\s*,\s*'[^']+'\s*,\s*'([A-Z][A-Z0-9_]*)'/g)) {
    codes.add(m[1]);
  }
  for (const m of src.matchAll(/\bcode:\s*'([A-Z][A-Z0-9_]*)'/g)) codes.add(m[1]);
  return [...codes];
}

describe('ledi-error-registry (P0 cobertura)', () => {
  it('tem ao menos 78 códigos registrados', () => {
    expect(allLediErrorCodes().length).toBeGreaterThanOrEqual(78);
  });

  it('todo código tem repairClass e severity válidos', () => {
    const classes = new Set(['auto', 'semi', 'individual', 'reexport', 'info']);
    const sevs = new Set(['BLOCKER', 'MONEY_RISK', 'QUALITY_WARN', 'INFO']);
    for (const d of Object.values(LEDI_ERROR_REGISTRY)) {
      expect(classes.has(d.repairClass)).toBe(true);
      expect(sevs.has(d.severity)).toBe(true);
      expect(d.title.length).toBeGreaterThan(3);
      expect(d.how.length).toBeGreaterThan(3);
      expect(d.tipos.length).toBeGreaterThan(0);
    }
  });

  it('códigos emitidos pelos validadores FAO/FAI/PROC ⊆ registry', () => {
    const emitted = new Set<string>([
      ...extractPushCodes('ledi-fao.validator.ts'),
      ...extractCodesFromSource('ledi-fai.validator.ts'),
      ...extractCodesFromSource('ledi-proc.validator.ts'),
      ...extractPrevineCodes('ledi-fao-previne-xray.ts'),
      'WRONG_FICHA_TIPO', // batch.service
    ]);
    const missing = [...emitted].filter((c) => !LEDI_ERROR_REGISTRY[c]).sort();
    expect(missing).toEqual([]);
  });

  it('AUTO_FIXABLE_CODES coincide com auto implementados no registry', () => {
    const fromReg = new Set(autoFixableCodes());
    const fromFixer = AUTO_FIXABLE_CODES;
    const onlyFixer = [...fromFixer].filter((c) => !fromReg.has(c)).sort();
    const onlyReg = [...fromReg].filter((c) => !fromFixer.has(c)).sort();
    expect({ onlyFixer, onlyReg }).toEqual({ onlyFixer: [], onlyReg: [] });
  });

  it('espelho web tem os mesmos códigos e repairClass', () => {
    const webPath = path.resolve(
      CARE_EXTRA,
      '../../../web/src/lib/ledi/error-registry.ts',
    );
    expect(fs.existsSync(webPath)).toBe(true);
    const webSrc = fs.readFileSync(webPath, 'utf8');
    for (const code of allLediErrorCodes()) {
      expect(webSrc).toContain(`${code}: {`);
      const d = LEDI_ERROR_REGISTRY[code];
      expect(webSrc).toContain(`repairClass: '${d.repairClass}'`);
    }
  });

  it('coverageSummary lista pending só para não implementados', () => {
    const sum = coverageSummary();
    expect(sum.total).toBe(allLediErrorCodes().length);
    for (const code of sum.pendingImplement) {
      expect(LEDI_ERROR_REGISTRY[code].implemented).toBe(false);
    }
  });
});
