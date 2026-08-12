'use client';

import Link from 'next/link';
import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, PageHeader } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { displayPatientName } from '@/lib/labels';

type Facility = { id: string; name: string };
type Team = { id: string; name: string; facilityId: string; teamTypeId?: string; ine?: string | null };
type MicroArea = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  teamId: string;
  team?: Team & { facility?: Facility };
};
type Patient = { id: string; civilName: string; socialName?: string | null };
type LinkRow = {
  id: string;
  active: boolean;
  patientId: string;
  teamId: string;
  microAreaId?: string | null;
  patient?: Patient;
  team?: Team & { facility?: Facility };
  microArea?: { id: string; code: string; name: string } | null;
};

function TerritoryInner() {
  const params = useSearchParams();
  const { facilityId } = useAuth();
  const initialPatient = params.get('paciente') || '';
  const [tab, setTab] = useState<'microareas' | 'vinculos'>(
    initialPatient ? 'vinculos' : 'microareas',
  );
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [teams, setTeams] = useState<Team[]>([]);
  const [microAreas, setMicroAreas] = useState<MicroArea[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);

  const [teamId, setTeamId] = useState('');
  const [maCode, setMaCode] = useState('');
  const [maName, setMaName] = useState('');

  const [newTeamName, setNewTeamName] = useState('eSF Nova');
  const [newTeamIne, setNewTeamIne] = useState('');

  const [linkPatientId, setLinkPatientId] = useState(initialPatient);
  const [linkTeamId, setLinkTeamId] = useState('');
  const [linkMicroAreaId, setLinkMicroAreaId] = useState('');
  const [filterPatientId, setFilterPatientId] = useState(initialPatient);

  const microsForLinkTeam = useMemo(
    () => microAreas.filter((m) => m.teamId === linkTeamId && m.active),
    [microAreas, linkTeamId],
  );

  async function load() {
    setError(null);
    const qsTeam = facilityId ? `?facilityId=${facilityId}` : '';
    const [t, ma, pts, ln] = await Promise.all([
      api<Team[]>(`/v1/teams${qsTeam}`),
      api<MicroArea[]>('/v1/micro-areas'),
      api<Patient[]>('/v1/patients'),
      api<LinkRow[]>(
        filterPatientId
          ? `/v1/patient-team-links?patientId=${encodeURIComponent(filterPatientId)}`
          : '/v1/patient-team-links',
      ),
    ]);
    setTeams(t);
    setMicroAreas(ma);
    setPatients(pts);
    setLinks(ln);
    if (!teamId && t[0]) setTeamId(t[0].id);
    if (!linkTeamId && t[0]) setLinkTeamId(t[0].id);
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Falha ao carregar'));
  }, [facilityId, filterPatientId]);

  useEffect(() => {
    if (initialPatient) {
      setLinkPatientId(initialPatient);
      setFilterPatientId(initialPatient);
      setTab('vinculos');
    }
  }, [initialPatient]);

  async function createTeam(e: FormEvent) {
    e.preventDefault();
    if (!facilityId) {
      setError('Selecione uma unidade antes de criar equipe.');
      return;
    }
    setError(null);
    setOk(null);
    try {
      await api('/v1/teams', {
        method: 'POST',
        json: {
          facilityId,
          name: newTeamName,
          teamTypeId: 'ESF',
          ine: newTeamIne || undefined,
        },
      });
      setOk('Equipe criada.');
      setNewTeamName('eSF Nova');
      setNewTeamIne('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar equipe');
    }
  }

  async function createMicroArea(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    try {
      await api('/v1/micro-areas', {
        method: 'POST',
        json: { teamId, code: maCode, name: maName, active: true },
      });
      setOk('Microárea criada.');
      setMaCode('');
      setMaName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar microárea');
    }
  }

  async function createLink(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    try {
      await api('/v1/patient-team-links', {
        method: 'POST',
        json: {
          patientId: linkPatientId,
          teamId: linkTeamId,
          microAreaId: linkMicroAreaId || undefined,
          active: true,
        },
      });
      setOk('Vínculo paciente↔equipe registrado.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao vincular');
    }
  }

  return (
    <>
      <PageHeader
        title="Território"
        description="Equipes, microáreas e vínculo do paciente à equipe (APS simplificado — B7)."
        actions={<HelpLink id="cadastros.territorio" />}
      />
      <ErrorBox message={error} />
      {ok ? (
        <div className="alert" style={{ borderColor: 'var(--ok-bd)', background: 'var(--ok-bg)' }}>
          {ok}
        </div>
      ) : null}

      <div className="row" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className={`btn ${tab === 'microareas' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('microareas')}
        >
          Equipes / Microáreas
        </button>
        <button
          type="button"
          className={`btn ${tab === 'vinculos' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('vinculos')}
        >
          Vínculos paciente
        </button>
      </div>

      {tab === 'microareas' ? (
        <div className="stack">
          <form className="card grid-2" onSubmit={createTeam}>
            <h3 style={{ gridColumn: '1 / -1', margin: 0 }}>Nova equipe na unidade atual</h3>
            <div className="field">
              <label>Nome</label>
              <input required value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} />
            </div>
            <div className="field">
              <label>INE (opcional)</label>
              <input className="mono" value={newTeamIne} onChange={(e) => setNewTeamIne(e.target.value)} />
            </div>
            <button className="btn btn-secondary" type="submit">
              Criar equipe
            </button>
          </form>

          <form className="card grid-2" onSubmit={createMicroArea}>
            <h3 style={{ gridColumn: '1 / -1', margin: 0 }}>Nova microárea</h3>
            <div className="field">
              <label>Equipe</label>
              <select required value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Código</label>
              <input className="mono" required maxLength={16} value={maCode} onChange={(e) => setMaCode(e.target.value)} />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Nome</label>
              <input required value={maName} onChange={(e) => setMaName(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit">
              Criar microárea
            </button>
          </form>

          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nome</th>
                  <th>Equipe</th>
                  <th>Unidade</th>
                  <th>Ativa</th>
                </tr>
              </thead>
              <tbody>
                {microAreas.map((m) => (
                  <tr key={m.id}>
                    <td className="mono">{m.code}</td>
                    <td>{m.name}</td>
                    <td>{m.team?.name || m.teamId}</td>
                    <td>{m.team?.facility?.name || '—'}</td>
                    <td>{m.active ? 'Sim' : 'Não'}</td>
                  </tr>
                ))}
                {microAreas.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Nenhuma microárea — use o seed demo ou crie acima.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'vinculos' ? (
        <div className="stack">
          <form className="card grid-2" onSubmit={createLink}>
            <h3 style={{ gridColumn: '1 / -1', margin: 0 }}>Vincular paciente à equipe</h3>
            <div className="field">
              <label>Paciente</label>
              <select required value={linkPatientId} onChange={(e) => setLinkPatientId(e.target.value)}>
                <option value="">Selecionar…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {displayPatientName(p)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Equipe</label>
              <select
                required
                value={linkTeamId}
                onChange={(e) => {
                  setLinkTeamId(e.target.value);
                  setLinkMicroAreaId('');
                }}
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Microárea (opcional)</label>
              <select value={linkMicroAreaId} onChange={(e) => setLinkMicroAreaId(e.target.value)}>
                <option value="">— sem microárea —</option>
                {microsForLinkTeam.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} — {m.name}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" type="submit">
              Salvar vínculo
            </button>
          </form>

          <div className="card row">
            <label style={{ fontWeight: 600 }}>Filtrar por paciente</label>
            <select
              value={filterPatientId}
              onChange={(e) => setFilterPatientId(e.target.value)}
              style={{ flex: 1, minHeight: 44 }}
            >
              <option value="">Todos</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {displayPatientName(p)}
                </option>
              ))}
            </select>
          </div>

          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Equipe</th>
                  <th>Microárea</th>
                  <th>Unidade</th>
                  <th>Ativo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {links.map((l) => (
                  <tr key={l.id}>
                    <td>
                      {l.patient ? (
                        <Link href={`/pacientes/${l.patientId}`}>{displayPatientName(l.patient)}</Link>
                      ) : (
                        l.patientId
                      )}
                    </td>
                    <td>{l.team?.name || l.teamId}</td>
                    <td>
                      {l.microArea ? `${l.microArea.code} — ${l.microArea.name}` : '—'}
                    </td>
                    <td>{l.team?.facility?.name || '—'}</td>
                    <td>{l.active ? 'Sim' : 'Não'}</td>
                    <td>
                      <Link href={`/territorio?paciente=${l.patientId}`}>Filtrar</Link>
                    </td>
                  </tr>
                ))}
                {links.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Nenhum vínculo encontrado.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function TerritoryPage() {
  return (
    <AppShell helpId="cadastros.territorio">
      <Suspense fallback={<p>Carregando território…</p>}>
        <TerritoryInner />
      </Suspense>
    </AppShell>
  );
}
