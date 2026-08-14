import { LEDI_ERROR_REGISTRY } from './ledi-error-registry';
import {
  PENDING_REPORT_CSV_COLUMNS,
  assertIdentifiersMasked,
  assertNoPedagogicalMoney,
  buildPendingReport,
  extractFichaIdentity,
  itemIsPending,
  maskCns,
  maskCpf,
  parseSeverityFilter,
} from './ledi-pending-report';
import type { FaoFinding } from './ledi-fao.validator';

const CPF = '52998224725';
const CNS = '703601040321538';
const PROF = '126090861660005';
const UUID = '9647198-4F1FDA7E-B1D8-4496-AFB4-5ADCBC6389C7';

const SAMPLE_XML = `<?xml version="1.0" encoding="utf-8"?>
<ns3:dadoTransporteTransportXml>
<ns4:fichaAtendimentoOdontologicoMasterTransport>
<uuidFicha>${UUID}</uuidFicha>
<atendimentosOdontologicos>
<cnsCidadao>${CNS}</cnsCidadao>
<cpfCidadao>${CPF}</cpfCidadao>
<problemasCondicoes><ciap>D82</ciap></problemasCondicoes>
<dataHoraInicialAtendimento>1786038654000</dataHoraInicialAtendimento>
</atendimentosOdontologicos>
<headerTransport>
<lotacaoFormPrincipal>
<profissionalCNS>${PROF}</profissionalCNS>
<cboCodigo_2002>223208</cboCodigo_2002>
</lotacaoFormPrincipal>
<dataAtendimento>1786038654000</dataAtendimento>
</headerTransport>
</ns4:fichaAtendimentoOdontologicoMasterTransport>
</ns3:dadoTransporteTransportXml>`;

const blocker: FaoFinding = {
  severity: 'BLOCKER',
  code: 'CNS_INVALID',
  message: 'Cartão inválido',
  hint: 'Corrija o CNS',
};
const money: FaoFinding = {
  severity: 'MONEY_RISK',
  code: 'CNES_FORMAT',
  message: 'CNES com formato errado',
};
const quality: FaoFinding = {
  severity: 'QUALITY_WARN',
  code: 'XML_ENCODING',
  message: 'encoding',
};

describe('ledi-pending-report', () => {
  it('mascara CPF no formato ***.***.***-xx', () => {
    expect(maskCpf(CPF)).toBe('***.***.***-25');
    expect(maskCns(CNS)).toBe('***********1538');
  });

  it('extrai identidade sem devolver XML clínico', () => {
    const id = extractFichaIdentity(SAMPLE_XML);
    expect(id.uuidFicha).toBe(UUID);
    expect(id.cpfMasked).toBe('***.***.***-25');
    expect(id.cnsMasked).toBe('***********1538');
    expect(id.profissionalCnsMasked).toBe('***********0005');
    expect(id.dataAtendimento).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(JSON.stringify(id)).not.toContain(CPF);
    expect(JSON.stringify(id)).not.toContain(CNS);
    expect(JSON.stringify(id)).not.toContain('D82');
  });

  it('ignora fichas ideais (sem BLOCKER/MONEY_RISK/QUALITY_WARN)', () => {
    expect(
      itemIsPending([{ severity: 'INFO', code: 'X', message: '' }], null, null),
    ).toBe(false);
    expect(itemIsPending([blocker], null, null)).toBe(true);
  });

  it('monta relatório com registry, gate Siaps vs qualidade e CSV/MD', () => {
    const report = buildPendingReport({
      batchId: 'lote-1',
      name: 'Lote teste',
      expectedTipo: 'FAO',
      totalFichas: 3,
      generatedAt: '2026-08-14T12:00:00.000Z',
      items: [
        {
          itemId: 'a',
          fileName: 'ok.xml',
          xml: SAMPLE_XML,
          findings: [],
          fichaTipo: 'FAO',
        },
        {
          itemId: 'b',
          fileName: 'bloqueio.xml',
          xml: SAMPLE_XML,
          findings: [blocker, quality],
          fichaTipo: 'FAO',
        },
        {
          itemId: 'c',
          fileName: 'qualidade.xml',
          xml: SAMPLE_XML,
          findings: [money],
          previne: {
            channel: 'PREVINE_ESB_B1_B6',
            summary: { moneyRisks: 1, qualityWarns: 0, infos: 0 },
            gaps: [
              {
                code: 'PREVINE_INE_MISSING',
                indicator: 'QUALITY',
                severity: 'MONEY_RISK',
                message: 'INE ausente',
              },
            ],
          } as never,
          fichaTipo: 'FAO',
        },
      ],
    });

    expect(report.pendingCount).toBe(2);
    expect(report.fichas.map((f) => f.fileName)).toEqual(['bloqueio.xml', 'qualidade.xml']);

    const bloqueio = report.fichas[0]!;
    expect(bloqueio.gate).toBe('bloqueia_siaps');
    expect(bloqueio.siapsReady).toBe(false);
    expect(bloqueio.cpfMasked).toBe('***.***.***-25');
    const cnsIssue = bloqueio.issues.find((i) => i.code === 'CNS_INVALID');
    expect(cnsIssue?.title).toBe(LEDI_ERROR_REGISTRY.CNS_INVALID.title);
    expect(cnsIssue?.how).toBe(LEDI_ERROR_REGISTRY.CNS_INVALID.how);
    expect(cnsIssue?.blocksSiaps).toBe(true);

    const qualidade = report.fichas[1]!;
    expect(qualidade.gate).toBe('qualidade_previne');
    expect(qualidade.siapsReady).toBe(true);

    const header = report.csv.split('\n')[0];
    expect(header).toBe(PENDING_REPORT_CSV_COLUMNS.join(','));
    expect(report.csv).toContain('bloqueio.xml');
    expect(report.csv).toContain('CNS_INVALID');
    expect(report.csv).toContain('bloqueia_siaps');
    expect(report.csv).toContain('qualidade_previne');

    expect(report.markdown).toContain('bloqueia Siaps/envio');
    expect(report.markdown).toContain('só qualidade / Previne');
    expect(assertNoPedagogicalMoney(report.markdown)).toBe(true);
    expect(assertNoPedagogicalMoney(report.csv)).toBe(true);

    const blob = JSON.stringify(report);
    expect(assertIdentifiersMasked(blob, [CPF, CNS, PROF])).toBe(true);
    expect(blob).not.toContain('<problemasCondicoes>');
    expect(blob).not.toContain('D82');
  });

  it('filtra por severity=', () => {
    const items = [
      {
        itemId: '1',
        fileName: 'b.xml',
        xml: '<uuidFicha>abc</uuidFicha>',
        findings: [blocker, quality],
      },
      {
        itemId: '2',
        fileName: 'q.xml',
        xml: '<uuidFicha>def</uuidFicha>',
        findings: [quality],
      },
    ];
    const onlyBlocker = buildPendingReport({
      batchId: 'x',
      name: 'x',
      expectedTipo: 'FAI',
      totalFichas: 2,
      items,
      severityFilter: parseSeverityFilter('BLOCKER'),
    });
    expect(onlyBlocker.pendingCount).toBe(1);
    expect(onlyBlocker.fichas[0]!.issues.every((i) => i.severity === 'BLOCKER')).toBe(true);
    expect(onlyBlocker.fichas[0]!.gate).toBe('bloqueia_siaps');

    const onlyQuality = buildPendingReport({
      batchId: 'x',
      name: 'x',
      expectedTipo: 'FAI',
      totalFichas: 2,
      items,
      severityFilter: parseSeverityFilter('QUALITY_WARN'),
    });
    expect(onlyQuality.pendingCount).toBe(2);
    expect(onlyQuality.fichas.every((f) => f.issues.every((i) => i.severity === 'QUALITY_WARN'))).toBe(
      true,
    );
  });

  it('rejeita severity inválida', () => {
    expect(() => parseSeverityFilter('R$')).toThrow(/inválida/);
  });
});
