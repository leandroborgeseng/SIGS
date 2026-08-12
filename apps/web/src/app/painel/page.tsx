'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getFacilityId } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

type Panel = {
  facility: { id: string; name: string; cnes: string };
  current: {
    code: string;
    deskLabel?: string | null;
    displayName?: string | null;
    serviceType: string;
    professional?: { civilName: string } | null;
  } | null;
  recent: Array<{
    id: string;
    code: string;
    deskLabel?: string | null;
    status: string;
  }>;
  waitingCount: number;
};

function PanelInner() {
  const params = useSearchParams();
  const facilityId = useMemo(
    () => params.get('facilityId') || getFacilityId() || '',
    [params],
  );
  const [data, setData] = useState<Panel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  async function refresh() {
    if (!facilityId) {
      setError('Informe ?facilityId=… na URL do painel.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/v1/queue/panel?facilityId=${encodeURIComponent(facilityId)}`);
      if (!res.ok) throw new Error(`Painel HTTP ${res.status}`);
      const json = (await res.json()) as Panel;
      setData((prev) => {
        if (prev?.current?.code !== json.current?.code && json.current?.code) {
          setFlash(true);
          setTimeout(() => setFlash(false), 1200);
        }
        return json;
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao atualizar painel');
    }
  }

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 3000);
    return () => clearInterval(t);
  }, [facilityId]);

  return (
    <div className={`panel-screen${flash ? ' panel-flash' : ''}`}>
      <header className="panel-top">
        <strong>{data?.facility.name || 'SIGS Franca'}</strong>
        <span>Aguardando: {data?.waitingCount ?? '—'}</span>
      </header>

      {error ? <div className="panel-error">{error}</div> : null}

      <main className="panel-main">
        <div className="panel-label">Senha</div>
        <div className="panel-code">{data?.current?.code || '—'}</div>
        <div className="panel-desk">{data?.current?.deskLabel || 'Aguarde a chamada'}</div>
        {data?.current?.displayName || data?.current?.professional?.civilName ? (
          <div className="panel-meta">
            {data.current.displayName || data.current.professional?.civilName}
          </div>
        ) : null}
      </main>

      <footer className="panel-recent">
        <div className="panel-label">Últimas chamadas</div>
        <div className="panel-recent-row">
          {(data?.recent || []).slice(0, 6).map((r) => (
            <span key={r.id} className="panel-chip">
              {r.code}
              {r.deskLabel ? ` · ${r.deskLabel}` : ''}
            </span>
          ))}
          {!data?.recent?.length ? <span className="panel-chip">—</span> : null}
        </div>
      </footer>
    </div>
  );
}

export default function PainelPage() {
  return (
    <Suspense fallback={<div className="panel-screen">Carregando painel…</div>}>
      <PanelInner />
    </Suspense>
  );
}
