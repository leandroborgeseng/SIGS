'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, OkBox, PageHeader, TableStateRow } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';

type TeamListItem = {
  id: string;
  name: string;
  ine: string | null;
  teamTypeId: string;
  teamTypeLabel: string;
  active: boolean;
  memberCount: number;
  hasMembers: boolean;
  facility: { id: string; name: string; cnes: string | null; municipalNetwork: boolean };
};

type TeamsResponse = {
  ibgeCode: string;
  gestao: string;
  counts: { teams: number; withMembers: number; withoutMembers: number };
  teams: TeamListItem[];
};

type MultiTeamRow = {
  professionalId: string;
  name: string;
  cns: string | null;
  teamCount: number;
  teams: Array<{
    teamId: string;
    teamName: string;
    ine: string | null;
    teamTypeId: string;
    teamTypeLabel: string;
    facilityName: string;
    facilityCnes: string | null;
    cbo: string;
    cboLabel: string;
  }>;
};

type MultiTeamResponse = {
  counts: { professionals: number };
  professionals: MultiTeamRow[];
};

type TeamTypeRow = { id: string; label: string };

type Tab = 'equipes' | 'multi';

function EquipesPageInner() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'multi' ? 'multi' : 'equipes';
  const initialQ = searchParams.get('ine') || searchParams.get('q') || '';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [list, setList] = useState<TeamsResponse | null>(null);
  const [multi, setMulti] = useState<MultiTeamResponse | null>(null);
  const [types, setTypes] = useState<TeamTypeRow[]>([]);
  const [q, setQ] = useState(initialQ);
  const [teamTypeId, setTeamTypeId] = useState('');
  const [onlyWithMembers, setOnlyWithMembers] = useState(false);
  const [onlyWithoutMembers, setOnlyWithoutMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncingPf, setSyncingPf] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const next = searchParams.get('ine') || searchParams.get('q') || '';
    if (next && next !== q) setQ(next);
    if (searchParams.get('tab') === 'multi') setTab('multi');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync URL → filtro
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ ibge: '3516200', gestao: 'municipal', activeOnly: '1' });
      if (q.trim()) qs.set('q', q.trim());
      if (teamTypeId) qs.set('teamTypeId', teamTypeId);
      const [teamsRes, multiRes, typesRes] = await Promise.all([
        api<TeamsResponse>(`/v1/cnes/teams?${qs}`),
        api<MultiTeamResponse>('/v1/cnes/multi-team?ibge=3516200&gestao=municipal'),
        api<{ types: TeamTypeRow[] }>('/v1/cnes/team-types'),
      ]);
      setList(teamsRes);
      setMulti(multiRes);
      setTypes(typesRes.types || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar equipes');
    } finally {
      setLoading(false);
    }
  }, [q, teamTypeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredTeams = useMemo(() => {
    let rows = list?.teams || [];
    if (onlyWithMembers) rows = rows.filter((t) => t.hasMembers);
    if (onlyWithoutMembers) rows = rows.filter((t) => !t.hasMembers);
    return rows;
  }, [list, onlyWithMembers, onlyWithoutMembers]);

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
        `Profissionais importados: +${res.professionals.created}/~${res.professionals.updated} · lotações +${res.assignments.created}/~${res.assignments.updated}`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao importar profissionais');
    } finally {
      setSyncingPf(false);
    }
  }

  async function exportCsv() {
    setExporting(true);
    setError(null);
    try {
      const res = await api<{ csv: string; filename: string; rowCount: number }>(
        '/v1/cnes/network-export?ibge=3516200&gestao=municipal',
      );
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      setOk(`CSV exportado (${res.rowCount} linhas).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao exportar CSV');
    } finally {
      setExporting(false);
    }
  }

  return (
    <AppShell helpId="cadastros.equipes">
      <PageHeader
        title="Equipes CNES"
        eyebrow="Cadastros"
        description="Rede Prefeitura Franca: clique na equipe para ver os membros. Tipo legível (ex.: 76 — EAP). Aba Multi-equipe cruza quem está em mais de uma."
        actions={
          <>
            <HelpLink id="cadastros.equipes" />
            <Link className="btn btn-secondary" href="/cadastros/cnes-auditoria">
              Auditoria CNES
            </Link>
            <button
              className="btn btn-secondary"
              type="button"
              disabled={exporting}
              onClick={() => void exportCsv()}
            >
              {exporting ? 'Exportando…' : 'Exportar CSV rede'}
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={syncingPf}
              onClick={() => void importPf()}
            >
              {syncingPf ? 'Importando…' : 'Importar profissionais'}
            </button>
          </>
        }
      />
      <ErrorBox message={error} />
      <OkBox message={ok} />

      {list ? (
        <p className="muted" style={{ marginBottom: 12 }}>
          {list.counts.teams} equipes · {list.counts.withMembers} com membros · {list.counts.withoutMembers}{' '}
          sem lotação
          {multi ? ` · ${multi.counts.professionals} em mais de uma equipe` : null}
        </p>
      ) : null}

      <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(
          [
            ['equipes', 'Equipes'],
            ['multi', `Multi-equipe (${multi?.counts.professionals ?? 0})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'btn btn-primary' : 'btn btn-secondary'}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'multi' ? (
        <section className="card">
          <div className="section-label">Em mais de uma equipe</div>
          <p className="muted" style={{ marginTop: 0 }}>
            Cruzamento de lotações ativas com INE distintos na rede municipal.
          </p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Profissional</th>
                  <th>CNS</th>
                  <th>Qtd.</th>
                  <th>Equipes</th>
                </tr>
              </thead>
              <tbody>
                {(multi?.professionals || []).map((p) => (
                  <tr key={p.professionalId} style={{ background: 'rgba(180, 90, 40, 0.08)' }}>
                    <td>
                      <strong>{p.name}</strong>
                    </td>
                    <td className="mono">{p.cns || '—'}</td>
                    <td className="mono">{p.teamCount}</td>
                    <td>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {p.teams.map((t) => (
                          <li key={t.teamId}>
                            <Link href={`/equipes/${t.teamId}`}>{t.teamName}</Link>
                            <span className="muted">
                              {' '}
                              · {t.teamTypeId} — {t.teamTypeLabel} · {t.facilityName}
                              {t.facilityCnes ? ` (${t.facilityCnes})` : ''} · {t.cboLabel}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
                {!(multi?.professionals || []).length ? (
                  <TableStateRow
                    colSpan={4}
                    loading={loading}
                    empty="Ninguém com mais de uma equipe — importe profissionais lotados se a lista estiver vazia."
                  />
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="card">
          <div className="section-label">Equipes</div>
          <div className="grid-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Busca</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nome, INE, unidade, CNES"
              />
            </div>
            <div className="field">
              <label>Tipo</label>
              <select value={teamTypeId} onChange={(e) => setTeamTypeId(e.target.value)}>
                <option value="">Todos</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} — {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="row" style={{ gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={onlyWithMembers}
                onChange={(e) => {
                  setOnlyWithMembers(e.target.checked);
                  if (e.target.checked) setOnlyWithoutMembers(false);
                }}
              />
              Só com membros
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={onlyWithoutMembers}
                onChange={(e) => {
                  setOnlyWithoutMembers(e.target.checked);
                  if (e.target.checked) setOnlyWithMembers(false);
                }}
              />
              Só sem membros
            </label>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Equipe</th>
                  <th>Tipo</th>
                  <th>Membros</th>
                  <th>Unidade</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeams.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/equipes/${t.id}`}>{t.name}</Link>
                      <div className="muted mono" style={{ fontSize: 12 }}>
                        INE {t.ine || '—'}
                      </div>
                    </td>
                    <td>
                      <div>
                        {t.teamTypeId} — {t.teamTypeLabel}
                      </div>
                    </td>
                    <td>
                      <span className="mono">{t.memberCount}</span>
                      {!t.hasMembers ? (
                        <span className="muted" style={{ marginLeft: 6, fontSize: 12 }}>
                          sem membros
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <div>{t.facility.name}</div>
                      <div className="muted mono" style={{ fontSize: 12 }}>
                        {t.facility.cnes || '—'}
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredTeams.length ? (
                  <TableStateRow
                    colSpan={4}
                    loading={loading}
                    empty="Nenhuma equipe — sincronize CNES municipal e, se preciso, importe profissionais."
                  />
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AppShell>
  );
}

export default function EquipesPage() {
  return (
    <Suspense fallback={<p className="muted">Carregando equipes…</p>}>
      <EquipesPageInner />
    </Suspense>
  );
}
