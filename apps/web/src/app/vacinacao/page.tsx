'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, OkBox, PageHeader, TableStateRow } from '@/components/ui/PageHeader';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { displayPatientName, formatDateTime } from '@/lib/labels';

type Opt = { id: string; label: string; code?: string };
type Catalog = {
  immunobiologicals: Opt[];
  strategies: Opt[];
  doses: Opt[];
  routes: Opt[];
  sites: Opt[];
  attendanceGroups: Opt[];
};
type Patient = { id: string; civilName: string; socialName?: string | null };
type Professional = { id: string; civilName: string };
type VacRow = {
  id: string;
  appliedAt: string;
  patient: Patient;
  applicationsJson?: string;
};
type Card = {
  patientId: string;
  patientName: string;
  doses: Array<{
    date: string;
    immunobiological: string;
    dose: string;
    lot: string;
    strategy: string;
    status: string;
    recordId?: string;
  }>;
};

function VaccinationInner() {
  const params = useSearchParams();
  const { facilityId } = useAuth();
  const [tab, setTab] = useState<'aplicar' | 'cartao' | 'dia'>('aplicar');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [recent, setRecent] = useState<VacRow[]>([]);
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [patientId, setPatientId] = useState(params.get('paciente') || '');
  const [professionalId, setProfessionalId] = useState('');
  const [immunobiologicalId, setImm] = useState('BCG');
  const [strategyId, setStrategy] = useState('ROUTINE');
  const [doseId, setDose] = useState('DU');
  const [attendanceGroupId, setGroup] = useState('GERAL');
  const [lot, setLot] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [routeId, setRoute] = useState('ID');
  const [siteId, setSite] = useState('LD');
  const [prescriberCbo, setCbo] = useState('');
  const [indicationCid10, setCid] = useState('');
  const [leprosyContact, setLeprosy] = useState(false);

  const isSpecial = strategyId === 'SPECIAL';
  const isBcg = immunobiologicalId === 'BCG';

  const todayRows = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return recent.filter((r) => String(r.appliedAt).slice(0, 10) === today);
  }, [recent]);

  async function load() {
    const qs = facilityId ? `?facilityId=${encodeURIComponent(facilityId)}` : '';
    const [c, pts, list, profs] = await Promise.all([
      api<Catalog>('/v1/catalog/vaccination'),
      api<Patient[]>('/v1/patients'),
      api<VacRow[]>(`/v1/vaccinations${qs}`),
      api<Professional[]>('/v1/professionals'),
    ]);
    setCatalog(c);
    setPatients(pts);
    setRecent(list.slice(0, 50));
    setProfessionals(profs);
    if (!professionalId && profs[0]) setProfessionalId(profs[0].id);
    if (!patientId && params.get('paciente')) setPatientId(params.get('paciente')!);
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Falha'));
  }, [facilityId]);

  useEffect(() => {
    if (params.get('paciente')) {
      setPatientId(params.get('paciente')!);
      setTab('cartao');
    }
  }, [params]);

  useEffect(() => {
    if (tab !== 'cartao' || !patientId) {
      setCard(null);
      return;
    }
    void api<Card>(`/v1/patients/${patientId}/vaccination-card`)
      .then(setCard)
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha no cartão'));
  }, [tab, patientId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!facilityId) {
      setError('Selecione uma unidade antes de aplicar vacina.');
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await api<{ record?: { id: string }; productionBatch?: { id: string } }>('/v1/vaccinations', {
        method: 'POST',
        json: {
          patientId,
          facilityId,
          professionalId: professionalId || undefined,
          shift: 'MANHA',
          careLocation: 'UBS',
          applications: [
            {
              immunobiologicalId,
              strategyId,
              doseId,
              attendanceGroupId,
              lot,
              manufacturer,
              routeId,
              siteId,
              ...(isSpecial ? { prescriberCbo, indicationCid10 } : {}),
              ...(isBcg ? { leprosyContact } : {}),
            },
          ],
        },
      });
      setLot('');
      setOk(
        res.productionBatch?.id
          ? `Aplicação registrada — lote ${res.productionBatch.id.slice(0, 8)}… em Produção.`
          : 'Aplicação registrada.',
      );
      await load();
      if (tab === 'cartao') {
        setCard(await api<Card>(`/v1/patients/${patientId}/vaccination-card`));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao registrar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Vacinação"
        eyebrow="Operação"
        description="Aplicar · cartão vacinal · lista do dia."
        actions={
          <>
            <HelpLink id="vacinacao.aplicacao" />
            <Link className="btn btn-secondary" href="/producao">
              Produção
            </Link>
          </>
        }
      />
      <ErrorBox message={error} />
      <OkBox message={ok} />
      <div className="row" style={{ marginBottom: 12 }}>
        {(
          [
            ['aplicar', 'Aplicar'],
            ['cartao', 'Cartão vacinal'],
            ['dia', 'Lista do dia'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={`btn ${tab === k ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'aplicar' ? (
        <form className="card" onSubmit={onSubmit} style={{ marginBottom: 16 }}>
          <div className="grid-2">
            <div className="field">
              <label>Paciente *</label>
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
              <label>Imunobiológico *</label>
              <select value={immunobiologicalId} onChange={(e) => setImm(e.target.value)}>
                {(catalog?.immunobiologicals || []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Estratégia *</label>
              <select value={strategyId} onChange={(e) => setStrategy(e.target.value)}>
                {(catalog?.strategies || []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Dose *</label>
              <select value={doseId} onChange={(e) => setDose(e.target.value)}>
                {(catalog?.doses || []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Grupo de atendimento *</label>
              <select value={attendanceGroupId} onChange={(e) => setGroup(e.target.value)}>
                {(catalog?.attendanceGroups || []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Lote *</label>
              <input className="mono" required value={lot} onChange={(e) => setLot(e.target.value)} maxLength={30} />
            </div>
            <div className="field">
              <label>Fabricante *</label>
              <input required value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
            </div>
            <div className="field">
              <label>Via *</label>
              <select value={routeId} onChange={(e) => setRoute(e.target.value)}>
                {(catalog?.routes || []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Local de aplicação *</label>
              <select value={siteId} onChange={(e) => setSite(e.target.value)}>
                {(catalog?.sites || []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isSpecial ? (
            <div className="alert">
              <strong>Estratégia Especial</strong> — CBO e CID-10 obrigatórios.
              <div className="grid-2" style={{ marginTop: 8 }}>
                <div className="field">
                  <label>CBO do solicitante *</label>
                  <input className="mono" required value={prescriberCbo} onChange={(e) => setCbo(e.target.value)} />
                </div>
                <div className="field">
                  <label>CID-10 da indicação *</label>
                  <input className="mono" required value={indicationCid10} onChange={(e) => setCid(e.target.value)} />
                </div>
              </div>
            </div>
          ) : null}

          {isBcg ? (
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <input type="checkbox" checked={leprosyContact} onChange={(e) => setLeprosy(e.target.checked)} />
              Comunicante de hanseníase
            </label>
          ) : null}

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Registrando…' : 'Registrar aplicação'}
          </button>
        </form>
      ) : null}

      {tab === 'cartao' ? (
        <div className="card stack">
          <div className="field">
            <label>Paciente</label>
            <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">Selecionar…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {displayPatientName(p)}
                </option>
              ))}
            </select>
          </div>
          {card ? (
            <>
              <strong>{card.patientName}</strong>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!patientId}
                  onClick={() => {
                    void (async () => {
                      try {
                        const token = getToken();
                        const res = await fetch(`/api/v1/patients/${patientId}/vaccination-card.pdf`, {
                          headers: token ? { Authorization: `Bearer ${token}` } : {},
                        });
                        if (!res.ok) throw new Error(`PDF ${res.status}`);
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        window.open(url, '_blank');
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'Falha ao gerar PDF');
                      }
                    })();
                  }}
                >
                  Imprimir PDF (RF-14.13)
                </button>
              </div>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Imuno</th>
                      <th>Dose</th>
                      <th>Lote</th>
                      <th>Estratégia</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {card.doses.map((d, i) => (
                      <tr key={`${d.recordId || i}-${i}`}>
                        <td className="mono">{d.date}</td>
                        <td>{d.immunobiological}</td>
                        <td>{d.dose}</td>
                        <td className="mono">{d.lot}</td>
                        <td>{d.strategy}</td>
                        <td>{d.status}</td>
                      </tr>
                    ))}
                    {!card.doses.length ? <TableStateRow colSpan={6} empty="Sem doses no cartão." /> : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p style={{ color: 'var(--ink-3)' }}>Selecione um paciente para ver o cartão.</p>
          )}
        </div>
      ) : null}

      {tab === 'dia' ? (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Paciente</th>
              </tr>
            </thead>
            <tbody>
              {todayRows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{formatDateTime(r.appliedAt)}</td>
                  <td>{displayPatientName(r.patient)}</td>
                </tr>
              ))}
              {!todayRows.length ? (
                <TableStateRow
                  colSpan={2}
                  empty={facilityId ? 'Nenhuma aplicação hoje nesta unidade.' : 'Selecione uma unidade.'}
                />
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}

export default function VaccinationPage() {
  return (
    <AppShell helpId="vacinacao.aplicacao">
      <Suspense fallback={<p className="table-state">Carregando…</p>}>
        <VaccinationInner />
      </Suspense>
    </AppShell>
  );
}
