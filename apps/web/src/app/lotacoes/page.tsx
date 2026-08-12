'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, OkBox, PageHeader, TableStateRow } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { displayPatientName, formatDate } from '@/lib/labels';

type Professional = { id: string; civilName: string; socialName?: string | null };
type Team = { id: string; name: string };
type Assignment = {
  id: string;
  cbo: string;
  roleLabel?: string | null;
  active: boolean;
  startedAt: string;
  endedAt?: string | null;
  professional: Professional;
  facility: { name: string };
  team?: { name: string } | null;
};

export default function LotacoesPage() {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [facilityId, activeOnly]);

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

  return (
    <AppShell helpId="cadastros.lotacao">
      <PageHeader
        title="Lotações"
        eyebrow="Cadastros"
        description="Vínculo profissional × unidade × CBO (RF-2.60)."
        actions={<HelpLink id="cadastros.lotacao" />}
      />
      <ErrorBox message={error} />
      <OkBox message={ok} />

      <form className="card" onSubmit={onCreate} style={{ marginBottom: 16 }}>
        <div className="section-label">Nova lotação na unidade atual</div>
        <div className="grid-2">
          <div className="field">
            <label>Profissional</label>
            <select required value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {displayPatientName(p)}
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
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>CBO</label>
            <input className="mono" required value={cbo} onChange={(e) => setCbo(e.target.value)} maxLength={6} />
          </div>
          <div className="field">
            <label>Função</label>
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
              <th>CBO</th>
              <th>Função</th>
              <th>Equipe</th>
              <th>Início</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{displayPatientName(r.professional)}</td>
                <td className="mono">{r.cbo}</td>
                <td>{r.roleLabel || '—'}</td>
                <td>{r.team?.name || '—'}</td>
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
            ))}
            {!rows.length ? (
              <TableStateRow colSpan={7} loading={loading} empty="Nenhuma lotação nesta unidade." />
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
