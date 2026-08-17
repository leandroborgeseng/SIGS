'use client';

import { FormEvent, Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, OkBox, PageHeader, TableStateRow } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { displayPatientName, formatDate } from '@/lib/labels';

type Professional = {
  id: string;
  civilName: string;
  socialName?: string | null;
  cns?: string | null;
};
type Team = { id: string; name: string; ine?: string | null; teamTypeId?: string };
type Assignment = {
  id: string;
  cbo: string;
  roleLabel?: string | null;
  active: boolean;
  startedAt: string;
  endedAt?: string | null;
  professional: Professional;
  facility: { name: string; cnes?: string | null };
  team?: { id?: string; name: string; ine?: string | null } | null;
};

function LotacoesPageInner() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('assignmentId') || '';
  const { facilityId } = useAuth();
  const [rows, setRows] = useState<Assignment[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [professionalId, setProfessionalId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [cbo, setCbo] = useState('225125');
  const [roleLabel, setRoleLabel] = useState('Médico clínico');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeOnly, setActiveOnly] = useState(true);
  const [syncingPf, setSyncingPf] = useState(false);
  const highlightRef = useRef<HTMLTableRowElement | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (facilityId) qs.set('facilityId', facilityId);
      if (activeOnly) qs.set('activeOnly', '1');
      const [list, pros, tms] = await Promise.all([
        api<Assignment[]>(`/v1/assignments?${qs}`),
        api<Professional[]>('/v1/professionals'),
        facilityId ? api<Team[]>(`/v1/teams?facilityId=${facilityId}`) : Promise.resolve([]),
      ]);
      setRows(list);
      setProfessionals(pros);
      setTeams(tms);
      if (!professionalId && pros[0]) setProfessionalId(pros[0].id);
      if (highlightId) {
        const hit = list.find((r) => r.id === highlightId);
        if (hit) {
          setOk(
            `Lotação destacada da auditoria: ${displayPatientName(hit.professional)} · ${hit.facility.name}.`,
          );
        } else {
          setOk(
            `Lotação ${highlightId.slice(0, 8)}… não está na unidade atual — troque a unidade de trabalho ou veja todas as lotações.`,
          );
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId, activeOnly, highlightId]);

  useEffect(() => {
    if (!loading && highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [loading, highlightId, rows]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!facilityId) {
      setError('Selecione a unidade de trabalho.');
      return;
    }
    setError(null);
    setOk(null);
    try {
      await api('/v1/assignments', {
        method: 'POST',
        json: {
          professionalId,
          facilityId,
          teamId: teamId || undefined,
          cbo,
          roleLabel: roleLabel || undefined,
        },
      });
      setOk('Lotação criada.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar lotação');
    }
  }

  async function endOne(id: string) {
    if (!confirm('Encerrar esta lotação?')) return;
    try {
      await api(`/v1/assignments/${id}/end`, { method: 'POST', json: {} });
      setOk('Lotação encerrada.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao encerrar');
    }
  }

  async function importPf() {
    setSyncingPf(true);
    setError(null);
    setOk(null);
    try {
      const res = await api<{
        professionals: { created: number; updated: number };
        assignments: { created: number; updated: number };
      }>('/v1/cnes/sync-professionals?ibge=3516200', { method: 'POST' });
      setOk(
        `PF importados: +${res.professionals.created}/~${res.professionals.updated} · lotações +${res.assignments.created}/~${res.assignments.updated}`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao importar profissionais CNES');
    } finally {
      setSyncingPf(false);
    }
  }

  const empty = !loading && rows.length === 0;

  return (
    <AppShell helpId="cadastros.lotacao">
      <PageHeader
        title="Lotações"
        eyebrow="Cadastros"
        description="Vínculo profissional × unidade × CBO (RF-2.60). Dados CNES: CNS, INE e função."
        actions={
          <>
            <HelpLink id="cadastros.lotacao" />
            <Link className="btn btn-secondary" href="/equipes">
              Equipes
            </Link>
            <Link className="btn btn-secondary" href="/cadastros/cnes-auditoria">
              Auditoria CNES
            </Link>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={syncingPf}
              onClick={() => void importPf()}
            >
              {syncingPf ? 'Importando PF…' : 'Importar PF CNES'}
            </button>
          </>
        }
      />
      <ErrorBox message={error} />
      <OkBox message={ok} />

      {empty ? (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--warn, #b45309)' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Nenhuma lotação nesta unidade</p>
          <p className="muted" style={{ margin: '8px 0 0' }}>
            Importe profissionais lotados do CNES (rede Prefeitura) ou cadastre manualmente abaixo.
            Composição das equipes em <Link href="/equipes">/equipes</Link>.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 12 }}
            disabled={syncingPf}
            onClick={() => void importPf()}
          >
            {syncingPf ? 'Importando…' : 'Sincronizar profissionais CNES'}
          </button>
        </div>
      ) : null}

      <form className="card" onSubmit={onCreate} style={{ marginBottom: 16 }}>
        <div className="section-label">Nova lotação na unidade atual</div>
        <div className="grid-2">
          <div className="field">
            <label>Profissional</label>
            <select required value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {displayPatientName(p)}
                  {p.cns ? ` · CNS ${p.cns}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Equipe (opcional)</label>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">—</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.ine ? ` · INE ${t.ine}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>CBO</label>
            <input className="mono" required value={cbo} onChange={(e) => setCbo(e.target.value)} maxLength={6} />
          </div>
          <div className="field">
            <label>Função (label CBO)</label>
            <input value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary" type="submit">
          Vincular
        </button>
      </form>

      <div className="row" style={{ marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
          Só ativas
        </label>
        <button type="button" className="btn btn-secondary" onClick={() => void load()}>
          Atualizar
        </button>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Profissional</th>
              <th>CNS</th>
              <th>CBO / função</th>
              <th>Equipe / INE</th>
              <th>CNES</th>
              <th>Início</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isHit = !!highlightId && r.id === highlightId;
              return (
                <tr
                  key={r.id}
                  ref={isHit ? highlightRef : undefined}
                  style={
                    isHit
                      ? { background: 'rgba(40, 100, 160, 0.14)', outline: '2px solid rgba(40,100,160,0.45)' }
                      : undefined
                  }
                >
                  <td>{displayPatientName(r.professional)}</td>
                  <td className="mono">{r.professional.cns || '—'}</td>
                  <td>
                    {r.roleLabel || `CBO ${r.cbo}`}
                    <div className="muted mono" style={{ fontSize: 12 }}>
                      {r.cbo}
                    </div>
                  </td>
                  <td>
                    {r.team?.id ? (
                      <Link href={`/equipes/${r.team.id}`}>{r.team.name}</Link>
                    ) : (
                      r.team?.name || '—'
                    )}
                    {r.team?.ine ? (
                      <div className="muted mono" style={{ fontSize: 12 }}>
                        INE {r.team.ine}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    {r.facility.cnes ? (
                      <Link
                        href={`/unidades?cnes=${encodeURIComponent(r.facility.cnes)}`}
                        className="mono"
                        style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 'rgba(40,100,160,0.12)',
                          fontSize: 12,
                        }}
                      >
                        CNES {r.facility.cnes}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="mono">{formatDate(r.startedAt)}</td>
                  <td>{r.active ? 'Ativa' : `Encerrada ${r.endedAt ? formatDate(r.endedAt) : ''}`}</td>
                  <td>
                    {r.active ? (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => void endOne(r.id)}>
                        Encerrar
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {!rows.length ? (
              <TableStateRow colSpan={8} loading={loading} empty="Nenhuma lotação nesta unidade." />
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}

export default function LotacoesPage() {
  return (
    <Suspense fallback={<AppShell><p className="muted">Carregando lotações…</p></AppShell>}>
      <LotacoesPageInner />
    </Suspense>
  );
}
