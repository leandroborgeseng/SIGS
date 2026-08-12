import { parseTbProcedimentoLine, parseTbProcedimentoText } from './ms-procedimento.parser';

function padLine(code: string, name: string, competencia: string) {
  const c = code.padEnd(10, ' ').slice(0, 10);
  const n = name.padEnd(250, ' ').slice(0, 250);
  const mid = ' '.repeat(324 - 260); // gap until competencia
  return `${c}${n}${mid}${competencia}`;
}

describe('parseTbProcedimento (layout MS)', () => {
  it('extrai código, nome e competência', () => {
    const line = padLine('0301010064', 'Consulta medica em atencao basica', '202608');
    const row = parseTbProcedimentoLine(line);
    expect(row?.code).toBe('0301010064');
    expect(row?.name).toMatch(/Consulta medica/i);
    expect(row?.competencia).toBe('202608');
    expect(row?.groupCode).toBe('03');
  });

  it('ignora linhas inválidas', () => {
    expect(parseTbProcedimentoLine('')).toBeNull();
    expect(parseTbProcedimentoLine('Inicio,Tamanho,Campo')).toBeNull();
    expect(parseTbProcedimentoLine('ABC')).toBeNull();
  });

  it('parseia lote com fallback de competência', () => {
    const short = '0301010030Administracao de imunobiologicos';
    const out = parseTbProcedimentoText(`${short}\nxxx\n`, { competenciaFallback: '202607' });
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].code).toBe('0301010030');
    expect(out.rows[0].competencia).toBe('202607');
    expect(out.skipped).toBeGreaterThanOrEqual(1);
  });
});
