import PDFDocument from 'pdfkit';

export type VaccinationCardPdfInput = {
  patientId: string;
  patientName: string;
  cpf?: string | null;
  cns?: string | null;
  birthDate?: string | null;
  sex?: string | null;
  doses: Array<{
    date: string;
    immunobiological: string;
    dose: string;
    lot: string;
    strategy: string;
    status: string;
    recordId?: string;
  }>;
  generatedAt?: Date;
  municipio?: string;
};

function yn(v?: string | null): string {
  return v?.trim() || '—';
}

/** Cartão vacinal municipal (RF-14.13) — PDF simples para impressão. */
export async function buildVaccinationCardPdf(input: VaccinationCardPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 48,
      info: {
        Title: `Cartão vacinal — ${input.patientName}`,
        Author: 'SIGS',
        Subject: 'Cartão de vacinação municipal',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const when = (input.generatedAt || new Date()).toLocaleString('pt-BR');

    doc.fontSize(16).fillColor('#0f172a').text('Cartão de vacinação', { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#475569').text(`SIGS · ${input.municipio || 'Município'} · gerado em ${when}`);
    doc.moveDown(0.8);

    doc.fontSize(11).fillColor('#0f172a');
    doc.text(`Paciente: ${input.patientName}`);
    doc.text(`CPF: ${yn(input.cpf)} · CNS: ${yn(input.cns)}`);
    doc.text(`Nascimento: ${yn(input.birthDate)} · Sexo: ${yn(input.sex)}`);
    doc.text(`ID interno: ${input.patientId}`);
    doc.moveDown(0.8);

    doc.fontSize(12).text('Doses registradas');
    doc.moveDown(0.4);
    doc.fontSize(9).fillColor('#334155');

    if (!input.doses.length) {
      doc.text('Nenhuma dose registrada neste município.');
    } else {
      const header = 'Data       Imunobiológico     Dose   Lote            Estratégia     Status';
      doc.font('Courier').text(header);
      doc.moveDown(0.2);
      for (const d of input.doses) {
        const line = [
          (d.date || '').padEnd(10).slice(0, 10),
          (d.immunobiological || '').padEnd(18).slice(0, 18),
          (d.dose || '').padEnd(6).slice(0, 6),
          (d.lot || '').padEnd(15).slice(0, 15),
          (d.strategy || '').padEnd(14).slice(0, 14),
          (d.status || '').slice(0, 10),
        ].join(' ');
        doc.text(line);
      }
      doc.font('Helvetica');
    }

    doc.moveDown(1.2);
    doc.fontSize(8).fillColor('#64748b');
    doc.text(
      'Documento municipal de apoio. Não substitui caderneta oficial do PNI/RNDS. Sem dados reais de pacientes em ambiente de desenvolvimento.',
      { width: 500 },
    );

    doc.end();
  });
}
