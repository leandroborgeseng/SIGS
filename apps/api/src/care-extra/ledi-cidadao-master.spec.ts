import {
  appendCidadaoMasterCrossChecks,
  extractCidadaoIdsFromXml,
  findingCodeForTipo,
} from './ledi-cidadao-master';
import type { FaoFinding } from './ledi-fao.validator';

describe('ledi-cidadao-master P×2', () => {
  it('extrai CNS/CPF do XML', () => {
    const ids = extractCidadaoIdsFromXml(
      '<atendimentosDomiciliares><cnsCidadao>898001234567890</cnsCidadao><cpfCidadao>529.982.247-25</cpfCidadao></atendimentosDomiciliares>',
    );
    expect(ids.cns).toBe('898001234567890');
    expect(ids.cpf).toBe('52998224725');
  });

  it('emite MONEY_RISK quando CNS fora do mestre', () => {
    const findings: FaoFinding[] = [];
    appendCidadaoMasterCrossChecks(
      findings,
      { cns: '898001234567890', cpf: '' },
      'FAO',
      { knownCns: new Set(['111111111111111']), knownCpf: new Set() },
    );
    expect(findings.some((f) => f.code === 'FAO_CNS_NOT_IN_CADASTRO_INDIVIDUAL')).toBe(true);
    expect(findings[0].severity).toBe('MONEY_RISK');
  });

  it('não emite se CPF estiver no mestre', () => {
    const findings: FaoFinding[] = [];
    appendCidadaoMasterCrossChecks(
      findings,
      { cns: '898001234567890', cpf: '52998224725' },
      'FAI',
      { knownCns: new Set(), knownCpf: new Set(['52998224725']) },
    );
    expect(findings).toHaveLength(0);
  });

  it('mapeia códigos por tipo', () => {
    expect(findingCodeForTipo('PROCEDIMENTOS')).toBe('PROC_CNS_NOT_IN_CADASTRO_INDIVIDUAL');
    expect(findingCodeForTipo('dental_encounter')).toBe('FAO_CNS_NOT_IN_CADASTRO_INDIVIDUAL');
    expect(findingCodeForTipo('COLETIVO')).toBe('COLETIVO_PARTICIPANTE_NOT_IN_CADASTRO');
  });
});
