'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, OkBox, PageHeader } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { displayPatientName, formatDate, formatDateTime } from '@/lib/labels';

type Row = {
  id: string;
  status: string;
  priority: string;
  procedureCode: string;
  procedureName: string;
  offProtocol: boolean;
  cid?: string | null;
  clinicalSummary?: string | null;
  classification?: string | null;
  denialReason?: string | null;
  returnReason?: string | null;
  regulatorNotes?: string | null;
  scheduledHint?: string | null;
  decidedAt?: string | null;
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
  encounterId?: string | null;
};

export default function RegulationDetailPage() {
  const params = useParams<{ id: string }>();
  const [row, setRow] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [classification, setClassification] = useState('AMARELO');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [scheduledHint, setScheduledHint] = useState('');

  async function load() {
    const data = await api<Row>(`/v1/regulation/requests/${params.id}`);
    setRow(data);
    if (data.classification) setClassification(data.classification);
    if (data.regulatorNotes) setNotes(data.regulatorNotes);
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Falha'));
  }, [params.id]);

  async function act(path: string, body: Record<string, unknown> = {}) {
    setError(null);
    setOk(null);
    try {
      await api(`/v1/regulation/requests/${params.id}/${path}`, { method: 'POST', json: body });
      setOk('Atualizado.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha');
    }
  }

  function onClassify(e: FormEvent) {
    e.preventDefault();
    void act('classify', { classification, notes: notes || undefined });
  }

  const open = row && ['SUBMITTED', 'CLASSIFIED', 'RETURNED'].includes(row.status);

  return (
    <AppShell helpId="regulacao.fila">
      <PageHeader
        title="Solicitação de regulação"
        eyebrow="Gestão"
        description="Classificar, autorizar, negar ou devolver."
        actions={
          <>
            <HelpLink id="regulacao.fila" />
            <Link className="btn btn-secondary" href="/regulacao">
              Fila
            </Link>
            {row?.encounterId ? (
              <Link className="btn btn-secondary" href={`/atendimento/${row.encounterId}`}>
                Atendimento
              </Link>
            ) : null}
          </>
        }
      />
      <ErrorBox message={error} />
      <OkBox message={ok} />

      {row ? (
        <div className="split-clinical">
          <aside className="card stack">
            <div>
              <strong>{displayPatientName(row.patient)}</strong>
              <div className="mono" style={{ color: 'var(--ink-3)', fontSize: 12 }}>
                CPF {row.patient.cpf || '—'} · CNS {row.patient.cns || '—'}
              </div>
              <div className="mono" style={{ fontSize: 12 }}>
                Nasc. {formatDate(row.patient.birthDate)}
              </div>
            </div>
            <div>
              <div className="section-label">Unidade solicitante</div>
              {row.facility.name}
              <div className="mono" style={{ fontSize: 12 }}>
                CNES {row.facility.cnes}
              </div>
            </div>
            <div>
              <div className="section-label">Profissional</div>
              {row.professional?.civilName || '—'}
            </div>
            <div className="mono">{row.status}</div>
          </aside>

          <div className="stack">
            <div className="card">
              <div className="section-label">{row.procedureCode}</div>
              <h2 style={{ marginTop: 0 }}>{row.procedureName}</h2>
              <p>
                Prioridade: <strong>{row.priority}</strong>
                {row.classification ? ` · classificação ${row.classification}` : ''}
                {row.offProtocol ? ' · fora do protocolo' : ''}
              </p>
              <p>CID: {row.cid || '—'} · Criada em {formatDateTime(row.createdAt)}</p>
              {row.clinicalSummary ? <p>{row.clinicalSummary}</p> : null}
              {row.denialReason ? <div className="alert">Negada: {row.denialReason}</div> : null}
              {row.returnReason ? <div className="alert">Devolvida: {row.returnReason}</div> : null}
              {row.scheduledHint ? <p>Agendamento sugerido: {formatDate(row.scheduledHint)}</p> : null}
              {row.regulatorNotes ? <p>Notas: {row.regulatorNotes}</p> : null}
            </div>

            {open ? (
              <>
                <form className="card" onSubmit={onClassify}>
                  <div className="section-label">Classificar (RF-13.6)</div>
                  <div className="grid-2">
                    <div className="field">
                      <label>Classificação</label>
                      <select value={classification} onChange={(e) => setClassification(e.target.value)}>
                        <option value="VERDE">Verde</option>
                        <option value="AMARELO">Amarelo</option>
                        <option value="VERMELHO">Vermelho</option>
                        <option value="AZUL">Azul</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Notas do regulador</label>
                      <input value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>
                  </div>
                  <button className="btn btn-secondary" type="submit">
                    Salvar classificação
                  </button>
                </form>

                <div className="card stack">
                  <div className="section-label">Decisão (RF-13.8 / 13.9)</div>
                  <div className="field">
                    <label>Data sugerida de agendamento (opcional)</label>
                    <input type="date" value={scheduledHint} onChange={(e) => setScheduledHint(e.target.value)} />
                  </div>
                  <div className="row" style={{ flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() =>
                        void act('authorize', {
                          notes: notes || undefined,
                          scheduledHint: scheduledHint || undefined,
                        })
                      }
                    >
                      Autorizar
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        const r = reason.trim() || prompt('Motivo da devolução (falta de dados):');
                        if (!r) return;
                        setReason(r);
                        void act('return', { reason: r });
                      }}
                    >
                      Devolver
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => {
                        const r = reason.trim() || prompt('Motivo clínico da negação:');
                        if (!r) return;
                        setReason(r);
                        void act('deny', { reason: r, notes: notes || undefined });
                      }}
                    >
                      Negar
                    </button>
                  </div>
                </div>
              </>
            ) : null}

            {row.status !== 'CLOSED' && row.status !== 'DENIED' ? (
              <div className="card">
                <button type="button" className="btn btn-secondary" onClick={() => void act('close', { notes })}>
                  Encerrar solicitação
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
