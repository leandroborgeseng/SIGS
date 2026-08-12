'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, OkBox, PageHeader } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { displayPatientName, formatDate, formatDateTime } from '@/lib/labels';

type Rx = {
  id: string;
  status: string;
  recipeType: string;
  hasOffCatalog: boolean;
  notes?: string | null;
  validUntil?: string | null;
  issuedAt?: string | null;
  createdAt: string;
  patient: {
    civilName: string;
    socialName?: string | null;
    cpf?: string | null;
    cns?: string | null;
    birthDate: string;
  };
  facility: { name: string; cnes: string };
  professional?: { civilName: string } | null;
  items: Array<{
    dose: string;
    frequency: string;
    duration?: string | null;
    quantity?: string | null;
    route?: string | null;
    instructions?: string | null;
    offCatalog: boolean;
    freeTextName?: string | null;
    medication?: { name: string; code: string } | null;
  }>;
};

export default function PrescriptionDetailPage() {
  const params = useParams<{ id: string }>();
  const [row, setRow] = useState<Rx | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function load() {
    setRow(await api<Rx>(`/v1/prescriptions/${params.id}`));
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Falha'));
  }, [params.id]);

  async function issue(forceOffCatalog = false) {
    setError(null);
    setOk(null);
    try {
      await api(`/v1/prescriptions/${params.id}/issue`, {
        method: 'POST',
        json: { forceOffCatalog },
      });
      setOk('Receita emitida.');
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao emitir';
      if (/forceOffCatalog/i.test(msg) && confirm(`${msg}\n\nEmitir mesmo assim?`)) {
        await issue(true);
        return;
      }
      setError(msg);
    }
  }

  async function cancel() {
    if (!confirm('Cancelar esta receita?')) return;
    try {
      await api(`/v1/prescriptions/${params.id}/cancel`, { method: 'POST', json: {} });
      setOk('Receita cancelada.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao cancelar');
    }
  }

  return (
    <AppShell helpId="atendimento.prescricao">
      <PageHeader
        title="Receita"
        eyebrow="Operação"
        description="Visualização / emissão do receituário."
        actions={
          <>
            <HelpLink id="atendimento.prescricao" />
            <Link className="btn btn-secondary" href="/prescricoes">
              Voltar
            </Link>
            <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
              Imprimir
            </button>
          </>
        }
      />
      <ErrorBox message={error} />
      <OkBox message={ok} />

      {row ? (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            {row.status === 'DRAFT' ? (
              <button type="button" className="btn btn-primary" onClick={() => void issue()}>
                Emitir receita
              </button>
            ) : null}
            {row.status !== 'CANCELLED' ? (
              <button type="button" className="btn btn-danger" onClick={() => void cancel()}>
                Cancelar
              </button>
            ) : null}
          </div>

          <div className="card recipe-print">
            <div className="section-label">{row.facility.name}</div>
            <p style={{ marginTop: 0, fontSize: 13, color: 'var(--ink-3)' }}>CNES {row.facility.cnes}</p>
            <h2 style={{ margin: '8px 0 16px' }}>Receituário — {row.recipeType}</h2>
            <p>
              <strong>Paciente:</strong> {displayPatientName(row.patient)}
              <br />
              CPF {row.patient.cpf || '—'} · CNS {row.patient.cns || '—'} · Nasc. {formatDate(row.patient.birthDate)}
            </p>
            <p>
              <strong>Status:</strong> {row.status}
              {row.issuedAt ? ` · emitida em ${formatDateTime(row.issuedAt)}` : ''}
              {row.validUntil ? ` · válida até ${formatDate(row.validUntil)}` : ''}
            </p>
            {row.hasOffCatalog ? (
              <div className="alert">Contém medicamento fora do padrão municipal.</div>
            ) : null}
            <ol>
              {row.items.map((i, idx) => (
                <li key={idx} style={{ marginBottom: 10 }}>
                  <strong>{i.medication?.name || i.freeTextName}</strong>
                  {i.offCatalog ? ' (fora do padrão)' : ''}
                  <br />
                  {i.dose} — {i.frequency}
                  {i.duration ? ` — ${i.duration}` : ''}
                  {i.route ? ` — via ${i.route}` : ''}
                  {i.quantity ? ` — qtd ${i.quantity}` : ''}
                  {i.instructions ? (
                    <>
                      <br />
                      <em>{i.instructions}</em>
                    </>
                  ) : null}
                </li>
              ))}
            </ol>
            {row.notes ? <p>Obs.: {row.notes}</p> : null}
            <p style={{ marginTop: 28 }}>
              Profissional: {row.professional?.civilName || '—'}
            </p>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
