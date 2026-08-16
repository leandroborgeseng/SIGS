'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { CodeSearchSelect } from '@/components/ui/CodeSearchSelect';
import { ErrorBox, HelpLink, OkBox, PageHeader, StatusPill } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ENCOUNTER_STATUS_LABEL, displayPatientName, formatDate } from '@/lib/labels';

type Clinical = {
  soapSubjective?: string;
  soapObjective?: string;
  soapAssessment?: string;
  soapPlan?: string;
  ciapCodes?: string[];
  cidCodes?: string[];
};

type Encounter = {
  id: string;
  status: string;
  facilityId: string;
  professionalId?: string | null;
  clinical?: Clinical;
  patient: {
    id: string;
    civilName: string;
    socialName?: string | null;
    cpf?: string | null;
    cns?: string | null;
    birthDate: string;
  };
};

type Med = {
  id: string;
  code: string;
  name: string;
  recipeType: string;
  defaultRoute?: string | null;
};

type Rx = {
  id: string;
  status: string;
  recipeType: string;
  hasOffCatalog: boolean;
  items: Array<{ freeTextName?: string | null; medication?: Med | null; dose: string; frequency: string }>;
};

type RegProc = { code: string; name: string; requiresCid: boolean };
type RegReq = {
  id: string;
  status: string;
  procedureCode: string;
  procedureName: string;
  priority: string;
  offProtocol: boolean;
};

export default function ClinicalPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { facilityId } = useAuth();
  const [continued, setContinued] = useState(false);
  const [row, setRow] = useState<Encounter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [s, setS] = useState('');
  const [o, setO] = useState('');
  const [a, setA] = useState('');
  const [p, setP] = useState('');
  const [ciap, setCiap] = useState('');
  const [cid, setCid] = useState('');
  const [outcome, setOutcome] = useState('ALTA');
  const [busy, setBusy] = useState(false);

  const [meds, setMeds] = useState<Med[]>([]);
  const [rxList, setRxList] = useState<Rx[]>([]);
  const [medId, setMedId] = useState('');
  const [freeText, setFreeText] = useState('');
  const [dose, setDose] = useState('1 comprimido');
  const [frequency, setFrequency] = useState('1x ao dia');
  const [duration, setDuration] = useState('30 dias');
  const [route, setRoute] = useState('ORAL');

  const [regProcs, setRegProcs] = useState<RegProc[]>([]);
  const [regList, setRegList] = useState<RegReq[]>([]);
  const [regCode, setRegCode] = useState('');
  const [regFree, setRegFree] = useState('');
  const [regCid, setRegCid] = useState('');
  const [regPriority, setRegPriority] = useState('ELETIVO');
  const [regSummary, setRegSummary] = useState('');

  useEffect(() => {
    setContinued(new URLSearchParams(window.location.search).get('continuado') === '1');
  }, []);

  async function load() {
    const data = await api<Encounter>(`/v1/encounters/${params.id}`);
    setRow(data);
    const c = data.clinical || {};
    setS(c.soapSubjective || '');
    setO(c.soapObjective || '');
    setA(c.soapAssessment || '');
    setP(c.soapPlan || '');
    setCiap((c.ciapCodes || [])[0] || '');
    setCid((c.cidCodes || [])[0] || '');

    const [catalog, list, regCatalog, regs] = await Promise.all([
      api<Med[]>('/v1/catalog/medications'),
      api<Rx[]>(`/v1/prescriptions?encounterId=${params.id}`),
      api<{ procedures: RegProc[] }>('/v1/regulation/catalog'),
      api<RegReq[]>(`/v1/regulation/requests?encounterId=${params.id}`),
    ]);
    setMeds(catalog);
    setRxList(list);
    setRegProcs(regCatalog.procedures || []);
    setRegList(regs);
    if (!medId && catalog[0]) setMedId(catalog[0].id);
    if (!regCode && regCatalog.procedures?.[0]) setRegCode(regCatalog.procedures[0].code);
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Falha'));
  }, [params.id]);

  async function saveDraft(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/encounters/${params.id}/clinical`, {
        method: 'PUT',
        json: {
          soapSubjective: s,
          soapObjective: o,
          soapAssessment: a,
          soapPlan: p,
          ciapCodes: ciap.trim() ? [ciap.trim()] : [],
          cidCodes: cid.trim() ? [cid.trim()] : [],
        },
      });
      setOk('Rascunho clínico salvo.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar');
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/encounters/${params.id}/clinical`, {
        method: 'PUT',
        json: {
          soapSubjective: s,
          soapObjective: o,
          soapAssessment: a,
          soapPlan: p,
          ciapCodes: ciap.trim() ? [ciap.trim()] : [],
          cidCodes: cid.trim() ? [cid.trim()] : [],
        },
      });
      await api(`/v1/encounters/${params.id}/finish`, {
        method: 'POST',
        json: { outcomes: [outcome] },
      });
      router.push('/atendimento');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao finalizar');
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: string) {
    try {
      await api(`/v1/encounters/${params.id}/status`, { method: 'PATCH', json: { status } });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao alterar status');
    }
  }

  async function addPrescription(e: FormEvent) {
    e.preventDefault();
    if (!row) return;
    setError(null);
    setOk(null);
    try {
      const rx = await api<Rx>('/v1/prescriptions', {
        method: 'POST',
        json: {
          patientId: row.patient.id,
          facilityId: row.facilityId || facilityId,
          professionalId: row.professionalId || undefined,
          encounterId: row.id,
          items: [
            {
              medicationId: freeText.trim() ? undefined : medId || undefined,
              freeTextName: freeText.trim() || undefined,
              dose,
              frequency,
              duration,
              route,
            },
          ],
        },
      });
      setOk(
        rx.hasOffCatalog
          ? 'Prescrição criada com alerta: medicamento fora do padrão municipal.'
          : 'Prescrição criada (rascunho).',
      );
      setFreeText('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na prescrição');
    }
  }

  async function issueRx(id: string, forceOffCatalog = false) {
    setError(null);
    setOk(null);
    try {
      await api(`/v1/prescriptions/${id}/issue`, {
        method: 'POST',
        json: { forceOffCatalog },
      });
      setOk('Receita emitida.');
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao emitir';
      if (/forceOffCatalog/i.test(msg) && confirm(`${msg}\n\nEmitir mesmo assim?`)) {
        await issueRx(id, true);
        return;
      }
      setError(msg);
    }
  }

  async function addRegulation(e: FormEvent) {
    e.preventDefault();
    if (!row) return;
    setError(null);
    setOk(null);
    try {
      const free = regFree.trim();
      const req = await api<RegReq>('/v1/regulation/requests', {
        method: 'POST',
        json: {
          patientId: row.patient.id,
          facilityId: row.facilityId || facilityId,
          professionalId: row.professionalId || undefined,
          encounterId: row.id,
          procedureCode: free ? free.slice(0, 40).toUpperCase().replace(/\s+/g, '_') : regCode,
          procedureName: free || undefined,
          cid: regCid.trim() || undefined,
          clinicalSummary: regSummary.trim() || undefined,
          priority: regPriority,
          submit: true,
        },
      });
      setOk(
        req.offProtocol
          ? 'Solicitação enviada à regulação com alerta: fora do protocolo municipal.'
          : 'Solicitação enviada à central de regulação.',
      );
      setRegFree('');
      setRegSummary('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na regulação');
    }
  }

  return (
    <AppShell helpId="atendimento.prescricao">
      <PageHeader
        title="Atendimento clínico"
        eyebrow="Operação"
        description="SOAP / CIAP / CID + prescrição e regulação."
        actions={
          <>
            <HelpLink id="atendimento.prescricao" />
            <Link className="btn btn-secondary" href="/prescricoes">
              Receitas
            </Link>
            <Link className="btn btn-secondary" href="/regulacao">
              Regulação
            </Link>
          </>
        }
      />
      <ErrorBox message={error} />
      <OkBox message={ok} />
      {continued ? (
        <div className="alert" style={{ borderColor: 'var(--ok-bd)', background: 'var(--ok-bg)', marginBottom: 12 }}>
          Cidadão já estava na fila do dia — continuando o mesmo atendimento.
        </div>
      ) : null}
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
            <StatusPill status={row.status} map={ENCOUNTER_STATUS_LABEL} />
            <div className="field">
              <label>Status da fila</label>
              <select value={row.status} onChange={(e) => void setStatus(e.target.value)}>
                {Object.keys(ENCOUNTER_STATUS_LABEL).map((k) => (
                  <option key={k} value={k}>
                    {ENCOUNTER_STATUS_LABEL[k].label}
                  </option>
                ))}
              </select>
            </div>
          </aside>
          <div className="stack">
            <form className="card" onSubmit={saveDraft}>
              <div className="field">
                <label>Subjetivo (S)</label>
                <textarea rows={3} value={s} onChange={(e) => setS(e.target.value)} />
              </div>
              <div className="field">
                <label>Objetivo (O)</label>
                <textarea rows={3} value={o} onChange={(e) => setO(e.target.value)} />
              </div>
              <div className="field">
                <label>Avaliação (A)</label>
                <textarea rows={3} value={a} onChange={(e) => setA(e.target.value)} />
              </div>
              <div className="field">
                <label>Plano (P)</label>
                <textarea rows={3} value={p} onChange={(e) => setP(e.target.value)} />
              </div>
              <div className="grid-2">
                <CodeSearchSelect
                  kind="ciap"
                  domain="aps"
                  label="CIAP-2"
                  value={ciap}
                  onChange={setCiap}
                  placeholder="Buscar CIAP…"
                />
                <CodeSearchSelect
                  kind="cid10"
                  domain="aps"
                  label="CID-10"
                  value={cid}
                  onChange={setCid}
                  placeholder="Buscar CID-10…"
                />
              </div>
              <div className="field">
                <label>Desfecho (ao finalizar)</label>
                <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                  <option value="ALTA">Alta do episódio</option>
                  <option value="RETORNO">Retorno consulta agendada</option>
                  <option value="ENCAMINHAMENTO">Encaminhamento especializado</option>
                  <option value="ENCAMINHAMENTO_URGENCIA">Encaminhamento urgência</option>
                  <option value="OBSERVACAO">Manter em observação</option>
                </select>
              </div>
              <div className="row">
                <button className="btn btn-secondary" type="submit" disabled={busy}>
                  Salvar rascunho
                </button>
                <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void finish()}>
                  Finalizar atendimento
                </button>
              </div>
            </form>

            <form className="card" onSubmit={addPrescription}>
              <div className="section-label">Prescrição (RF-3.33)</div>
              <div className="field">
                <label>Medicamento do catálogo municipal</label>
                <select value={medId} onChange={(e) => setMedId(e.target.value)} disabled={!!freeText.trim()}>
                  {meds.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.recipeType})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Ou digite fora do padrão (gera alerta)</label>
                <input
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder="Nome do medicamento não padronizado…"
                />
              </div>
              <div className="grid-2">
                <div className="field">
                  <label>Dose</label>
                  <input required value={dose} onChange={(e) => setDose(e.target.value)} />
                </div>
                <div className="field">
                  <label>Frequência</label>
                  <input required value={frequency} onChange={(e) => setFrequency(e.target.value)} />
                </div>
                <div className="field">
                  <label>Duração</label>
                  <input value={duration} onChange={(e) => setDuration(e.target.value)} />
                </div>
                <div className="field">
                  <label>Via</label>
                  <select value={route} onChange={(e) => setRoute(e.target.value)}>
                    <option value="ORAL">Oral</option>
                    <option value="IM">IM</option>
                    <option value="IV">IV</option>
                    <option value="SC">SC</option>
                    <option value="TOPICA">Tópica</option>
                  </select>
                </div>
              </div>
              <button className="btn btn-primary" type="submit">
                Adicionar prescrição
              </button>

              {rxList.length ? (
                <div style={{ marginTop: 16 }}>
                  <div className="section-label">Receitas deste atendimento</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {rxList.map((rx) => (
                      <li key={rx.id} style={{ marginBottom: 8 }}>
                        <span className="mono">{rx.status}</span> · {rx.recipeType}
                        {rx.hasOffCatalog ? ' · fora do padrão' : ''} —{' '}
                        {rx.items.map((i) => i.medication?.name || i.freeTextName).join(', ')}{' '}
                        <Link href={`/prescricoes/${rx.id}`}>abrir</Link>
                        {rx.status === 'DRAFT' ? (
                          <>
                            {' '}
                            ·{' '}
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void issueRx(rx.id)}>
                              Emitir
                            </button>
                          </>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </form>

            <form className="card" onSubmit={addRegulation}>
              <div className="section-label">Regulação / encaminhamento (RF-3.52)</div>
              <div className="field">
                <label>Procedimento pré-regulado</label>
                <select value={regCode} onChange={(e) => setRegCode(e.target.value)} disabled={!!regFree.trim()}>
                  {regProcs.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                      {p.requiresCid ? ' (exige CID)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Ou código/nome fora do protocolo (alerta RF-3.59)</label>
                <input
                  value={regFree}
                  onChange={(e) => setRegFree(e.target.value)}
                  placeholder="Ex.: procedimento não padronizado…"
                />
              </div>
              <div className="grid-2">
                <div className="field">
                  <label>CID</label>
                  <input className="mono" value={regCid} onChange={(e) => setRegCid(e.target.value)} placeholder="I10" />
                </div>
                <div className="field">
                  <label>Prioridade</label>
                  <select value={regPriority} onChange={(e) => setRegPriority(e.target.value)}>
                    <option value="ELETIVO">Eletivo</option>
                    <option value="PRIORITARIO">Prioritário</option>
                    <option value="URGENTE">Urgente</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Resumo clínico</label>
                <textarea rows={2} value={regSummary} onChange={(e) => setRegSummary(e.target.value)} />
              </div>
              <button className="btn btn-primary" type="submit">
                Enviar à regulação
              </button>
              {regList.length ? (
                <div style={{ marginTop: 16 }}>
                  <div className="section-label">Solicitações deste atendimento</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {regList.map((r) => (
                      <li key={r.id} style={{ marginBottom: 8 }}>
                        <span className="mono">{r.status}</span> · {r.priority} — {r.procedureName}
                        {r.offProtocol ? ' · fora do protocolo' : ''}{' '}
                        <Link href={`/regulacao/${r.id}`}>abrir</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </form>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
