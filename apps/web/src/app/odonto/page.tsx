'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, PageHeader } from '@/components/ui/PageHeader';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { displayPatientName, formatDateTime } from '@/lib/labels';

type Patient = { id: string; civilName: string; socialName?: string | null };
type Professional = { id: string; civilName: string };
type Row = {
  id: string;
  status: string;
  startedAt: string;
  encounterType: string;
  patient: Patient;
  productionBatchId?: string | null;
};

type FaoFinding = {
  severity: string;
  code: string;
  message: string;
  field?: string;
  hint?: string;
  rndsImpact?: string;
};

type FaoReport = {
  conformant: boolean;
  detectedFormat: string;
  channel: string;
  summary: { blockers: number; moneyRisks: number; qualityWarns: number };
  findings: FaoFinding[];
};

export default function OdontoPage() {
  const { facilityId } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [patientId, setPatientId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [anamnese, setAnamnese] = useState('');
  const [tooth, setTooth] = useState('11');
  const [procCode, setProcCode] = useState('0101020010');
  const [procLabel, setProcLabel] = useState('Consulta odontológica');
  const [vigilancia, setVigilancia] = useState('1');
  const [ciap, setCiap] = useState('D82');
  const [outcome, setOutcome] = useState('ALTA');
  const [xmlText, setXmlText] = useState('');
  const [fao, setFao] = useState<FaoReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function load() {
    const qs = facilityId ? `?facilityId=${facilityId}` : '';
    const [list, pts, profs] = await Promise.all([
      api<Row[]>(`/v1/dental-encounters${qs}`),
      api<Patient[]>('/v1/patients'),
      api<Professional[]>('/v1/professionals'),
    ]);
    setRows(list);
    setPatients(pts);
    setProfessionals(profs);
    if (!professionalId && profs[0]) setProfessionalId(profs[0].id);
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Falha'));
  }, [facilityId]);

  async function open(e: FormEvent) {
    e.preventDefault();
    if (!facilityId) return setError('Selecione uma unidade.');
    setError(null);
    setOk(null);
    try {
      const row = await api<{ id: string }>('/v1/dental-encounters', {
        method: 'POST',
        json: {
          patientId,
          facilityId,
          professionalId: professionalId || undefined,
          anamnese,
          encounterType: 'CONSULTA',
          procedures: [{ tooth, code: procCode, label: procLabel, done: false }],
          odontogram: { [tooth]: 'C' },
        },
      });
      setAnamnese('');
      setOk(`Atendimento aberto (${row.id.slice(0, 8)}…). Finalize com vigilância + CIAP.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir');
    }
  }

  async function finish(id: string) {
    setError(null);
    setOk(null);
    setFao(null);
    try {
      const res = await api<{ productionBatch?: { id: string }; fao?: FaoReport }>(
        `/v1/dental-encounters/${id}/finish`,
        {
          method: 'POST',
          json: {
            outcomes: [outcome],
            vigilanciaSaudeBucal: [Number(vigilancia)],
            problemasCondicoes: [{ ciap }],
            tipoAtendimento: 5,
            gestante: false,
            stNaoPossuiCpf: false,
            enforceFaoConformity: true,
          },
        },
      );
      if (res.fao) setFao(res.fao);
      setOk(
        res.productionBatch?.id
          ? `Finalizado — lote ${res.productionBatch.id.slice(0, 8)}… (LEDI FAO).`
          : 'Atendimento odontológico finalizado.',
      );
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as { fao?: FaoReport; message?: { fao?: FaoReport } | string } | null;
        const nested =
          body && typeof body === 'object'
            ? body.fao || (typeof body.message === 'object' ? body.message?.fao : undefined)
            : undefined;
        if (nested) setFao(nested);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Falha ao finalizar');
      }
    }
  }

  async function validateXml(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    if (!xmlText.trim()) return setError('Cole ou carregue um XML LEDI FAO.');
    try {
      const report = await api<FaoReport>('/v1/dental/ledi/validate-xml', {
        method: 'POST',
        json: { xml: xmlText },
      });
      setFao(report);
      setOk(
        report.conformant
          ? 'XML conforme para canal LEDI → Siaps → RNDS (sem blockers/money risks).'
          : `Não conforme: ${report.summary.blockers} blockers, ${report.summary.moneyRisks} money risks.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na validação');
    }
  }

  function onXmlFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setXmlText(String(reader.result || ''));
    reader.readAsText(file);
  }

  return (
    <AppShell helpId="odonto.stub">
      <PageHeader
        title="Odontologia"
        eyebrow="Operação"
        description="FAO LEDI com críticas de conformidade Siaps/RNDS · importar XML · lote dental_encounter."
        actions={
          <>
            <HelpLink id="odonto.stub" />
            <Link className="btn btn-primary" href="/odonto/lote">
              Lote XML / correção
            </Link>
            <Link className="btn btn-secondary" href="/producao">
              Produção
            </Link>
          </>
        }
      />
      <ErrorBox message={error} />
      {ok ? (
        <div className="alert" style={{ borderColor: 'var(--ok-bd)', background: 'var(--ok-bg)', marginBottom: 12 }}>
          {ok}
        </div>
      ) : null}

      <form className="card" onSubmit={validateXml} style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Validar XML LEDI FAO (caminho Siaps / RNDS)</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Produção odonto APS/CEO não usa Bundle FHIR RIA neste fluxo — use a ficha FAO em XML LEDI
          (Portaria GM/MS 10.192/2026).
        </p>
        <div className="field">
          <label>Arquivo .xml</label>
          <input type="file" accept=".xml,text/xml,application/xml" onChange={(e) => onXmlFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="field">
          <label>Ou cole o XML</label>
          <textarea
            rows={8}
            className="mono"
            value={xmlText}
            onChange={(e) => setXmlText(e.target.value)}
            placeholder="<FichaAtendimentoOdontologicoMaster>…</FichaAtendimentoOdontologicoMaster>"
          />
        </div>
        <button className="btn btn-primary" type="submit">
          Validar conformidade
        </button>
      </form>

      {fao ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>
            Relatório FAO — {fao.conformant ? 'conforme' : 'não conforme'} ({fao.detectedFormat})
          </h3>
          <p className="mono muted">
            {fao.channel} · blockers={fao.summary.blockers} · money={fao.summary.moneyRisks} · warn=
            {fao.summary.qualityWarns}
          </p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Sev</th>
                  <th>Código</th>
                  <th>Mensagem</th>
                  <th>Campo / impacto</th>
                </tr>
              </thead>
              <tbody>
                {fao.findings.map((f, i) => (
                  <tr key={`${f.code}-${i}`}>
                    <td className="mono">{f.severity}</td>
                    <td className="mono">{f.code}</td>
                    <td>
                      {f.message}
                      {f.hint ? <div className="muted">{f.hint}</div> : null}
                    </td>
                    <td className="mono">
                      {f.field || '—'}
                      {f.rndsImpact ? <div className="muted">{f.rndsImpact}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <form className="card grid-2" onSubmit={open} style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Paciente</label>
          <select required value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">Selecionar…</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {displayPatientName(p)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Profissional</label>
          <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
            <option value="">Opcional…</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.civilName}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Dente</label>
          <input className="mono" value={tooth} onChange={(e) => setTooth(e.target.value)} />
        </div>
        <div className="field">
          <label>Código procedimento (SIGTAP)</label>
          <input className="mono" value={procCode} onChange={(e) => setProcCode(e.target.value)} />
        </div>
        <div className="field">
          <label>Descrição</label>
          <input value={procLabel} onChange={(e) => setProcLabel(e.target.value)} />
        </div>
        <div className="field">
          <label>Conduta (finish)</label>
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="ALTA">Alta do episódio</option>
            <option value="TRATAMENTO_CONCLUIDO">Tratamento concluído</option>
            <option value="RETORNO">Retorno</option>
          </select>
        </div>
        <div className="field">
          <label>Vigilância saúde bucal (id)</label>
          <input className="mono" value={vigilancia} onChange={(e) => setVigilancia(e.target.value)} />
        </div>
        <div className="field">
          <label>CIAP (problema/condição)</label>
          <input className="mono" value={ciap} onChange={(e) => setCiap(e.target.value)} />
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>Anamnese</label>
          <textarea rows={2} value={anamnese} onChange={(e) => setAnamnese(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit">
          Abrir atendimento
        </button>
      </form>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Paciente</th>
              <th>Tipo</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono">{formatDateTime(r.startedAt)}</td>
                <td>{displayPatientName(r.patient)}</td>
                <td>{r.encounterType}</td>
                <td>{r.status}</td>
                <td>
                  {r.status !== 'COMPLETED' ? (
                    <button type="button" className="btn btn-primary" onClick={() => void finish(r.id)}>
                      Finalizar (FAO)
                    </button>
                  ) : (
                    <span className="mono">{r.productionBatchId?.slice(0, 8)}…</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5}>Nenhum atendimento odontológico nesta unidade.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
