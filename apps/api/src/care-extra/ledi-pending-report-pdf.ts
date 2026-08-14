/**
 * PDF visual para a Secretaria de Saúde corrigir fichas LEDI.
 * Cores: BLOCKER vermelho · MONEY_RISK laranja · QUALITY_WARN oliva.
 * Sem R$, sem XML clínico, CPF/CNS já mascarados no relatório.
 */

import PDFDocument from 'pdfkit';
import type {
  PendingFicha,
  PendingIssue,
  PendingReport,
  PendingSeverity,
} from './ledi-pending-report';
import { assertNoPedagogicalMoney } from './ledi-pending-report';

const PAGE = {
  marginX: 40,
  marginTop: 36,
  marginBottom: 48,
};

const COLOR = {
  header: '#0B5F4B',
  headerInk: '#FFFFFF',
  ink: '#1B2430',
  muted: '#5C6570',
  line: '#D5DDE3',
  paper: '#F4F7F6',
  card: '#FFFFFF',
  blocker: '#C62828',
  blockerBg: '#FDECEA',
  money: '#E65100',
  moneyBg: '#FFF3E0',
  quality: '#6B7B12',
  qualityBg: '#F4F5E4',
  navy: '#1A365D',
  navyBg: '#E8EEF6',
};

const SEV: Record<
  PendingSeverity,
  { fill: string; bg: string; label: string; short: string }
> = {
  BLOCKER: {
    fill: COLOR.blocker,
    bg: COLOR.blockerBg,
    label: 'BLOCKER - bloqueia Siaps',
    short: 'Bloqueia envio',
  },
  MONEY_RISK: {
    fill: COLOR.money,
    bg: COLOR.moneyBg,
    label: 'MONEY_RISK - qualidade',
    short: 'Qualidade',
  },
  QUALITY_WARN: {
    fill: COLOR.quality,
    bg: COLOR.qualityBg,
    label: 'QUALITY_WARN - indicadores',
    short: 'Indicadores',
  },
};

export type BuildPendingPdfOpts = {
  compress?: boolean;
};

function sanitizePdfText(raw: string): string {
  return String(raw || '')
    .replace(/R\$\s*[\d.,]+/gi, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/[—–]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim();
}

function shortHow(how: string, max = 220): string {
  const s = sanitizePdfText(how);
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > 80 ? cut.slice(0, sp) : cut).trim()}...`;
}

function tipoLabel(raw: string): string {
  const t = (raw || '').toUpperCase();
  if (t === 'FAI') return 'FAI';
  if (t === 'FAO') return 'FAO';
  if (t === 'PROCEDIMENTOS' || t === 'PROC') return 'PROC';
  return sanitizePdfText(raw) || '-';
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return sanitizePdfText(iso);
  return d.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  });
}

function contentWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - PAGE.marginX * 2;
}

function bottomLimit(doc: PDFKit.PDFDocument): number {
  return doc.page.height - PAGE.marginBottom;
}

function remaining(doc: PDFKit.PDFDocument): number {
  return bottomLimit(doc) - doc.y;
}

function ensureSpace(doc: PDFKit.PDFDocument, h: number) {
  if (remaining(doc) < h) doc.addPage();
}

function worstSeverity(issues: PendingIssue[]): PendingSeverity {
  if (issues.some((i) => i.severity === 'BLOCKER')) return 'BLOCKER';
  if (issues.some((i) => i.severity === 'MONEY_RISK')) return 'MONEY_RISK';
  return 'QUALITY_WARN';
}

function dash(v: string | null | undefined): string {
  return sanitizePdfText(v || '') || '-';
}

function drawHeaderBand(doc: PDFKit.PDFDocument, report: PendingReport, cover: boolean) {
  const w = doc.page.width;
  const h = cover ? 96 : 42;
  doc.save();
  doc.rect(0, 0, w, h).fill(COLOR.header);
  doc.fillColor(COLOR.headerInk);
  if (cover) {
    doc.font('Helvetica').fontSize(9).text('SIGS  ·  Secretaria Municipal de Saúde', PAGE.marginX, 16, {
      width: w - PAGE.marginX * 2,
    });
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .text('Relatório do que falta nas fichas', PAGE.marginX, 34, { width: w - PAGE.marginX * 2 });
    doc
      .font('Helvetica')
      .fontSize(11)
      .text(
        `${sanitizePdfText(report.municipioNome || 'Franca')}  ·  IBGE ${sanitizePdfText(report.municipioIbge || '3516200')}`,
        PAGE.marginX,
        60,
        { width: w - PAGE.marginX * 2 },
      );
    doc
      .fontSize(9)
      .fillColor('#CDE8E0')
      .text('Para impressão e e-mail interno  ·  identificadores mascarados (LGPD)', PAGE.marginX, 76, {
        width: w - PAGE.marginX * 2,
      });
  } else {
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(
        `O que falta  ·  ${sanitizePdfText(report.municipioNome || 'Franca')}  ·  ${sanitizePdfText(report.name)}  ·  ${tipoLabel(report.expectedTipo)}`,
        PAGE.marginX,
        16,
        { width: w - PAGE.marginX * 2 },
      );
  }
  doc.restore();
  doc.y = h + 16;
}

function drawFooter(doc: PDFKit.PDFDocument, page: number, total: number) {
  const y = doc.page.height - 28;
  const prevBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.save();
  doc.moveTo(PAGE.marginX, y - 6).lineTo(doc.page.width - PAGE.marginX, y - 6).strokeColor(COLOR.line).lineWidth(0.6).stroke();
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor(COLOR.muted)
    .text('LGPD: CPF/CNS mascarados. Sem XML clínico. Sem valores em reais.', PAGE.marginX, y, {
      width: contentWidth(doc) - 90,
      lineBreak: false,
    });
  doc.text(`Página ${page} de ${total}`, PAGE.marginX, y, {
    width: contentWidth(doc),
    align: 'right',
    lineBreak: false,
  });
  doc.restore();
  doc.page.margins.bottom = prevBottom;
}

function drawMetaRow(doc: PDFKit.PDFDocument, report: PendingReport) {
  const w = contentWidth(doc);
  const x = PAGE.marginX;
  const y = doc.y;
  const h = 52;
  doc.save();
  doc.roundedRect(x, y, w, h, 6).fill(COLOR.paper);
  const cols = [
    ['Lote', sanitizePdfText(report.name)],
    ['Id', report.batchId.slice(0, 8)],
    ['Tipo', tipoLabel(report.expectedTipo)],
    ['Gerado em', formatWhen(report.generatedAt)],
    ['Fichas no lote', String(report.totalFichas)],
  ];
  const colW = w / cols.length;
  cols.forEach(([label, value], i) => {
    const cx = x + 10 + i * colW;
    doc.fillColor(COLOR.muted).font('Helvetica').fontSize(7.5).text(label, cx, y + 10, { width: colW - 16 });
    doc.fillColor(COLOR.ink).font('Helvetica-Bold').fontSize(10).text(value, cx, y + 24, { width: colW - 16 });
  });
  doc.restore();
  doc.y = y + h + 14;
}

function drawSummaryCards(doc: PDFKit.PDFDocument, report: PendingReport) {
  const gap = 10;
  const w = (contentWidth(doc) - gap * 2) / 3;
  const x0 = PAGE.marginX;
  const y = doc.y;
  const h = 64;
  const cards: Array<{ value: number; label: string; fill: string; bg: string }> = [
    {
      value: report.pendingCount,
      label: 'Fichas neste recorte',
      fill: COLOR.navy,
      bg: COLOR.navyBg,
    },
    {
      value: report.fichasComBlocker,
      label: 'Bloqueiam Siaps / envio',
      fill: COLOR.blocker,
      bg: COLOR.blockerBg,
    },
    {
      value: report.fichasSoQualidade,
      label: 'Só qualidade / indicadores',
      fill: COLOR.money,
      bg: COLOR.moneyBg,
    },
  ];
  cards.forEach((c, i) => {
    const x = x0 + i * (w + gap);
    doc.save();
    doc.roundedRect(x, y, w, h, 6).fill(c.bg);
    doc.rect(x, y, 7, h).fill(c.fill);
    doc.fillColor(c.fill).font('Helvetica-Bold').fontSize(22).text(String(c.value), x + 18, y + 10, { width: w - 28 });
    doc.fillColor(COLOR.ink).font('Helvetica').fontSize(8.5).text(c.label, x + 18, y + 40, { width: w - 28 });
    doc.restore();
  });
  doc.y = y + h + 12;

  doc.font('Helvetica').fontSize(8).fillColor(COLOR.muted);
  doc.text(
    `Ocorrências: BLOCKER ${report.countsBySeverity.BLOCKER}  ·  MONEY_RISK ${report.countsBySeverity.MONEY_RISK}  ·  QUALITY_WARN ${report.countsBySeverity.QUALITY_WARN}` +
      (report.severityFilter?.length ? `  ·  Filtro: ${report.severityFilter.join(', ')}` : ''),
    PAGE.marginX,
    doc.y,
    { width: contentWidth(doc) },
  );
  doc.y += 6;
}

function drawLegend(doc: PDFKit.PDFDocument) {
  ensureSpace(doc, 28);
  const items: PendingSeverity[] = ['BLOCKER', 'MONEY_RISK', 'QUALITY_WARN'];
  let x = PAGE.marginX;
  const y = doc.y;
  items.forEach((sev) => {
    const s = SEV[sev];
    doc.save();
    doc.roundedRect(x, y, 10, 10, 2).fill(s.fill);
    doc.restore();
    doc.fillColor(COLOR.ink).font('Helvetica').fontSize(8).text(s.label, x + 14, y + 1, { lineBreak: false });
    x += 14 + doc.widthOfString(s.label) + 16;
  });
  doc.y = y + 22;
}

function drawIssue(doc: PDFKit.PDFDocument, issue: PendingIssue) {
  const s = SEV[issue.severity];
  const x = PAGE.marginX + 12;
  const w = contentWidth(doc) - 24;
  const title = sanitizePdfText(issue.title || issue.code);
  const how = shortHow(issue.how);
  doc.font('Helvetica-Bold').fontSize(9.5);
  const titleH = doc.heightOfString(title, { width: w - 20, lineGap: 1 });
  doc.font('Helvetica').fontSize(8.5);
  const howH = doc.heightOfString(how, { width: w - 20, lineGap: 1 });
  const h = 18 + titleH + howH + 10;
  ensureSpace(doc, Math.min(h, 80));
  const y = doc.y;
  doc.save();
  doc.roundedRect(x, y, w, Math.min(h, remaining(doc) - 2), 4).fill(s.bg);
  doc.rect(x, y, 4, Math.min(h, remaining(doc) - 2)).fill(s.fill);
  doc.restore();
  doc
    .font('Helvetica-Bold')
    .fontSize(7)
    .fillColor(s.fill)
    .text(s.short.toUpperCase(), x + 12, y + 6, { width: w - 20 });
  doc
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .fillColor(COLOR.ink)
    .text(title, x + 12, y + 18, { width: w - 20, lineGap: 1 });
  const afterTitle = doc.y;
  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor(COLOR.muted)
    .text(how, x + 12, afterTitle + 2, { width: w - 20, lineGap: 1 });
  doc.y = Math.max(doc.y, y + h) + 6;
}

function drawFicha(doc: PDFKit.PDFDocument, ficha: PendingFicha, index: number, total: number) {
  const sev = worstSeverity(ficha.issues);
  const accent = SEV[sev].fill;
  ensureSpace(doc, 92);
  const x = PAGE.marginX;
  const w = contentWidth(doc);
  const y0 = doc.y;

  doc.save();
  doc.rect(x, y0, 6, 8).fill(accent);
  doc.restore();

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(COLOR.ink)
    .text(
      `${index + 1}/${total}  ${sanitizePdfText(ficha.fileName)}`,
      x + 14,
      y0,
      { width: w - 160 },
    );
  const gate = ficha.gate === 'bloqueia_siaps' ? 'BLOQUEIA SIAPS' : 'SÓ QUALIDADE';
  const gateColor = ficha.gate === 'bloqueia_siaps' ? COLOR.blocker : COLOR.money;
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(gateColor)
    .text(gate, x, y0 + 2, { width: w, align: 'right' });

  doc.y = y0 + 18;
  const meta = [
    `UUID: ${dash(ficha.uuidFicha)}`,
    `CPF: ${dash(ficha.cpfMasked)}`,
    `CNS: ${dash(ficha.cnsMasked)}`,
    `Data: ${dash(ficha.dataAtendimento)}`,
  ];
  doc.font('Helvetica').fontSize(8).fillColor(COLOR.muted).text(meta.join('   ·   '), x + 14, doc.y, {
    width: w - 18,
  });
  if (ficha.profissionalCnsMasked || ficha.fichaTipo) {
    doc.text(
      [ficha.fichaTipo ? `Tipo da ficha: ${sanitizePdfText(ficha.fichaTipo)}` : '', ficha.profissionalCnsMasked ? `Profissional (CNS): ${ficha.profissionalCnsMasked}` : '']
        .filter(Boolean)
        .join('   ·   '),
      x + 14,
      doc.y,
      { width: w - 18 },
    );
  }
  doc.moveDown(0.35);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR.ink).text('O que corrigir', x + 14, doc.y);
  doc.moveDown(0.2);
  for (const issue of ficha.issues) {
    drawIssue(doc, issue);
  }
  doc.moveTo(x, doc.y).lineTo(x + w, doc.y).strokeColor(COLOR.line).lineWidth(0.5).stroke();
  doc.y += 12;
}

function drawEmpty(doc: PDFKit.PDFDocument) {
  ensureSpace(doc, 40);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(COLOR.muted)
    .text('Nenhuma ficha pendente neste recorte. Lote ideal ou apenas avisos INFO restantes.', PAGE.marginX, doc.y, {
      width: contentWidth(doc),
    });
}

export function buildPendingReportPdf(report: PendingReport, opts: BuildPendingPdfOpts = {}): Promise<Buffer> {
  const blob = `${report.markdown}\n${report.csv}\n${report.name}`;
  if (!assertNoPedagogicalMoney(blob)) {
    throw new Error('Relatorio contem valor em reais - PDF recusado.');
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      compress: opts.compress !== false,
      bufferPages: true,
      margins: {
        top: PAGE.marginTop,
        bottom: PAGE.marginBottom,
        left: PAGE.marginX,
        right: PAGE.marginX,
      },
      info: {
        Title: `O que falta - ${sanitizePdfText(report.name)}`,
        Author: 'SIGS - Secretaria Municipal de Saúde',
        Subject: 'Pendências de fichas LEDI para correção (identificadores mascarados)',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    let sealing = false;
    doc.on('pageAdded', () => {
      if (sealing) return;
      drawHeaderBand(doc, report, false);
    });

    drawHeaderBand(doc, report, true);
    drawMetaRow(doc, report);
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(COLOR.ink)
      .text('Capa / resumo', PAGE.marginX, doc.y);
    doc.moveDown(0.4);
    drawSummaryCards(doc, report);
    drawLegend(doc);

    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(COLOR.ink)
      .text('Fichas a corrigir', PAGE.marginX, doc.y);
    doc.moveDown(0.45);

    if (!report.fichas.length) {
      drawEmpty(doc);
    } else {
      report.fichas.forEach((f, i) => drawFicha(doc, f, i, report.fichas.length));
    }

    sealing = true;
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawFooter(doc, i + 1, range.count);
    }
    doc.end();
  });
}
