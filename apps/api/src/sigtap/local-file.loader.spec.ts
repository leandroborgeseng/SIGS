import { parseSigtapCsv, extractTbProcedimentoFromBuffer } from './local-file.loader';
import { parseTbProcedimentoText } from './ms-procedimento.parser';
import { readFileSync } from 'fs';
import { join } from 'path';
import JSZip from 'jszip';

describe('sigtap local-file.loader', () => {
  it('parseia CSV code,name,competencia', () => {
    const rows = parseSigtapCsv('code,name,competencia\n0301010064,Consulta medica,202608\n');
    expect(rows).toHaveLength(1);
    expect(rows[0].code).toBe('0301010064');
    expect(rows[0].competencia).toBe('202608');
  });

  it('lê fixture sintética TB_PROCEDIMENTO', () => {
    const roots = [
      join(process.cwd(), 'data', 'sigtap', 'fixture-tb-procedimento-sample.txt'),
      join(process.cwd(), '..', '..', 'data', 'sigtap', 'fixture-tb-procedimento-sample.txt'),
    ];
    const path = roots.find((p) => {
      try {
        readFileSync(p);
        return true;
      } catch {
        return false;
      }
    });
    expect(path).toBeTruthy();
    const content = readFileSync(path!, 'latin1');
    const parsed = parseTbProcedimentoText(content);
    expect(parsed.rows.length).toBeGreaterThanOrEqual(5);
    expect(parsed.rows[0].code).toMatch(/^\d{10}$/);
    expect(parsed.detectedCompetencia).toBe('202608');
  });

  it('extrai TB_PROCEDIMENTO de ZIP em memória', async () => {
    const line =
      '0301010064' +
      'Consulta medica em atencao basica'.padEnd(250, ' ') +
      ' '.repeat(64) +
      '202608';
    const zip = new JSZip();
    zip.file('TB_PROCEDIMENTO.txt', line + '\n');
    const buf = Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
    const { content, fromZip } = await extractTbProcedimentoFromBuffer(buf, 'TabelaUnificada_202608.zip');
    expect(fromZip).toBe(true);
    const parsed = parseTbProcedimentoText(content);
    expect(parsed.rows[0].code).toBe('0301010064');
  });
});
