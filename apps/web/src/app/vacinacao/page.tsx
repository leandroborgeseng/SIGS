'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { FieldToneLegend, LabeledField } from '@/components/ui/FieldHint';
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
  stock?: {
    status: string;
    note?: string;
    notIncluded?: string[];
  };
};
type Patient = { id: string; civilName: string; socialName?: string | null };
type Professional = { id: string; civilName: string };
type VacRow = {
  id: string;
  appliedAt: string;
  status?: string;
  patient: Patient;
  applicationsJson?: string;
};
type StockRow = {
  id: string;
  immunobiologicalId: string;
  lot: string;
  manufacturer?: string | null;
  expiresAt?: string | null;
  quantity: number;
  unit: string;
  targetTempMinC?: number | null;
  targetTempMaxC?: number | null;
  roomLabel?: string | null;
  coldEquipmentId?: string | null;
  coldEquipment?: { id: string; code: string; label: string } | null;
};
type ColdEq = {
  id: string;
  code: string;
  label: string;
  kind: string;
  targetTempMinC: number;
  targetTempMaxC: number;
  status: string;
};
type ThermalBox = {
  id: string;
  code: string;
  label: string;
  status: string;
  coldEquipmentId?: string | null;
  targetTempMinC?: number | null;
  targetTempMaxC?: number | null;
};
type TempReading = {
  id: string;
  temperatureC: number;
  withinRange: boolean;
  recordedAt: string;
  coldEquipment?: { code: string; label: string } | null;
  thermalBox?: { code: string; label: string } | null;
};
type SupplyRow = {
  id: string;
  sku: string;
  label: string;
  unit: string;
  quantity: number;
  links?: Array<{ immunobiologicalId: string; qtyPerDose: number }>;
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
  const [tab, setTab] = useState<'aplicar' | 'cartao' | 'dia' | 'estoque'>('aplicar');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [recent, setRecent] = useState<VacRow[]>([]);
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [coldEqs, setColdEqs] = useState<ColdEq[]>([]);
  const [thermalBoxes, setThermalBoxes] = useState<ThermalBox[]>([]);
  const [tempReadings, setTempReadings] = useState<TempReading[]>([]);
  const [supplies, setSupplies] = useState<SupplyRow[]>([]);
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
  const [lotExpiry, setLotExpiry] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [routeId, setRoute] = useState('ID');
  const [siteId, setSite] = useState('LD');
  const [prescriberCbo, setCbo] = useState('');
  const [indicationCid10, setCid] = useState('');
  const [leprosyContact, setLeprosy] = useState(false);

  const [stockImm, setStockImm] = useState('BCG');
  const [stockLot, setStockLot] = useState('');
  const [stockMfr, setStockMfr] = useState('');
  const [stockExpiry, setStockExpiry] = useState('');
  const [stockQty, setStockQty] = useState('10');
  const [stockTempMin, setStockTempMin] = useState('2');
  const [stockTempMax, setStockTempMax] = useState('8');
  const [stockRoom, setStockRoom] = useState('');
  const [stockColdEq, setStockColdEq] = useState('');

  const [eqCode, setEqCode] = useState('');
  const [eqLabel, setEqLabel] = useState('');
  const [eqKind, setEqKind] = useState('REFRIGERATOR');
  const [eqMin, setEqMin] = useState('2');
  const [eqMax, setEqMax] = useState('8');

  const [boxCode, setBoxCode] = useState('');
  const [boxLabel, setBoxLabel] = useState('');
  const [boxEq, setBoxEq] = useState('');

  const [readEq, setReadEq] = useState('');
  const [readBox, setReadBox] = useState('');
  const [readTemp, setReadTemp] = useState('5');

  const [supSku, setSupSku] = useState('');
  const [supLabel, setSupLabel] = useState('');
  const [supQty, setSupQty] = useState('50');
  const [linkImm, setLinkImm] = useState('BCG');
  const [linkSupplyId, setLinkSupplyId] = useState('');

  const isSpecial = strategyId === 'SPECIAL';
  const isBcg = immunobiologicalId === 'BCG';

  const todayRows = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return recent.filter((r) => String(r.appliedAt).slice(0, 10) === today);
  }, [recent]);

  async function load() {
    const qs = facilityId ? `?facilityId=${encodeURIComponent(facilityId)}` : '';
    const stockQs = facilityId ? `?facilityId=${encodeURIComponent(facilityId)}` : '';
    const readingsQs = facilityId
      ? `?facilityId=${encodeURIComponent(facilityId)}&limit=20`
      : '?limit=20';
    const [c, pts, list, profs, stock, eqs, boxes, reads, sups] = await Promise.all([
      api<Catalog>('/v1/catalog/vaccination'),
      api<Patient[]>('/v1/patients'),
      api<VacRow[]>(`/v1/vaccinations${qs}`),
      api<Professional[]>('/v1/professionals'),
      api<StockRow[]>(`/v1/vaccination-stock${stockQs}`),
      api<ColdEq[]>(`/v1/vaccination-cold-equipment${stockQs}`),
      api<ThermalBox[]>(`/v1/vaccination-thermal-boxes${stockQs}`),
      api<TempReading[]>(`/v1/vaccination-temp-readings${readingsQs}`),
      api<SupplyRow[]>(`/v1/vaccination-supplies${stockQs}`),
    ]);
    setCatalog(c);
    setPatients(pts);
    setRecent(list.slice(0, 50));
    setProfessionals(profs);
    setStockRows(stock);
    setColdEqs(eqs);
    setThermalBoxes(boxes);
    setTempReadings(reads);
    setSupplies(sups);
    if (!professionalId && profs[0]) setProfessionalId(profs[0].id);
    if (!patientId && params.get('paciente')) setPatientId(params.get('paciente')!);
    if (!linkSupplyId && sups[0]) setLinkSupplyId(sups[0].id);
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
              ...(lotExpiry ? { lotExpiry } : {}),
              ...(isSpecial ? { prescriberCbo, indicationCid10 } : {}),
              ...(isBcg ? { leprosyContact } : {}),
            },
          ],
        },
      });
      setLot('');
      setLotExpiry('');
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

  async function onStockSubmit(e: FormEvent) {
    e.preventDefault();
    if (!facilityId) {
      setError('Selecione uma unidade antes de lançar estoque.');
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api('/v1/vaccination-stock', {
        method: 'POST',
        json: {
          facilityId,
          immunobiologicalId: stockImm,
          lot: stockLot,
          manufacturer: stockMfr || undefined,
          expiresAt: stockExpiry || undefined,
          quantity: Number(stockQty),
          unit: 'dose',
          targetTempMinC: stockTempMin !== '' ? Number(stockTempMin) : undefined,
          targetTempMaxC: stockTempMax !== '' ? Number(stockTempMax) : undefined,
          roomLabel: stockRoom || undefined,
          coldEquipmentId: stockColdEq || undefined,
        },
      });
      setStockLot('');
      setStockQty('10');
      setOk('Entrada de estoque registrada (frio beyond-MVP — sem IoT contínuo).');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no estoque');
    } finally {
      setBusy(false);
    }
  }

  async function onColdEqSubmit(e: FormEvent) {
    e.preventDefault();
    if (!facilityId) {
      setError('Selecione uma unidade.');
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api('/v1/vaccination-cold-equipment', {
        method: 'POST',
        json: {
          facilityId,
          code: eqCode,
          label: eqLabel,
          kind: eqKind,
          targetTempMinC: Number(eqMin),
          targetTempMaxC: Number(eqMax),
        },
      });
      setEqCode('');
      setEqLabel('');
      setOk('Equipamento frio cadastrado (RF-14.17).');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no equipamento');
    } finally {
      setBusy(false);
    }
  }

  async function onBoxSubmit(e: FormEvent) {
    e.preventDefault();
    if (!facilityId) {
      setError('Selecione uma unidade.');
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api('/v1/vaccination-thermal-boxes', {
        method: 'POST',
        json: {
          facilityId,
          code: boxCode,
          label: boxLabel,
          coldEquipmentId: boxEq || undefined,
        },
      });
      setBoxCode('');
      setBoxLabel('');
      setOk('Caixa térmica cadastrada (RF-14.18).');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na caixa térmica');
    } finally {
      setBusy(false);
    }
  }

  async function onTempSubmit(e: FormEvent) {
    e.preventDefault();
    if (!facilityId) {
      setError('Selecione uma unidade.');
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await api<{ withinRange: boolean }>('/v1/vaccination-temp-readings', {
        method: 'POST',
        json: {
          facilityId,
          coldEquipmentId: readEq || undefined,
          thermalBoxId: readBox || undefined,
          temperatureC: Number(readTemp),
        },
      });
      setOk(
        res.withinRange
          ? 'Leitura registrada — dentro da faixa alvo.'
          : 'Leitura registrada — FORA da faixa alvo (RF-14.19 manual).',
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na leitura');
    } finally {
      setBusy(false);
    }
  }

  async function onSupplySubmit(e: FormEvent) {
    e.preventDefault();
    if (!facilityId) {
      setError('Selecione uma unidade.');
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api('/v1/vaccination-supplies', {
        method: 'POST',
        json: {
          facilityId,
          sku: supSku,
          label: supLabel,
          quantity: Number(supQty),
          unit: 'un',
        },
      });
      setSupSku('');
      setSupLabel('');
      setOk('Insumo registrado (RF-14.4/14.6 leve).');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no insumo');
    } finally {
      setBusy(false);
    }
  }

  async function onLinkSubmit(e: FormEvent) {
    e.preventDefault();
    if (!linkSupplyId) {
      setError('Selecione um insumo para vincular.');
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api('/v1/vaccination-supply-links', {
        method: 'POST',
        json: {
          immunobiologicalId: linkImm,
          supplyId: linkSupplyId,
          qtyPerDose: 1,
        },
      });
      setOk(`Vínculo ${linkImm} → insumo criado (baixa na aplicação).`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no vínculo');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Vacinação"
        eyebrow="Operação"
        description="Aplicar · estoque/frio · insumos · cartão · lista do dia."
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
            ['estoque', 'Estoque / frio'],
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
          <FieldToneLegend />
          <div className="grid-2">
            <LabeledField label="Paciente *" tone="siaps">
              <select required value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                <option value="">Selecionar…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {displayPatientName(p)}
                  </option>
                ))}
              </select>
            </LabeledField>
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
            <LabeledField
              label="Imunobiológico *"
              tone="siaps"
              hint="VAC_IMUNO_MISSING — BLOCKER no pré-envio."
            >
              <select value={immunobiologicalId} onChange={(e) => setImm(e.target.value)}>
                {(catalog?.immunobiologicals || []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>
            </LabeledField>
            <LabeledField label="Estratégia *" tone="siaps">
              <select value={strategyId} onChange={(e) => setStrategy(e.target.value)}>
                {(catalog?.strategies || []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>
            </LabeledField>
            <LabeledField label="Dose *" tone="siaps">
              <select value={doseId} onChange={(e) => setDose(e.target.value)}>
                {(catalog?.doses || []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>
            </LabeledField>
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
            <LabeledField
              label="Lote *"
              tone="siaps"
              hint="VAC_LOT_MISSING — MONEY_RISK / risco de rejeição se ausente."
            >
              <input className="mono" required value={lot} onChange={(e) => setLot(e.target.value)} maxLength={30} />
            </LabeledField>
            <div className="field">
              <label>Validade do lote</label>
              <input type="date" value={lotExpiry} onChange={(e) => setLotExpiry(e.target.value)} />
            </div>
            <LabeledField label="Fabricante *" tone="siaps">
              <input required value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
            </LabeledField>
            <LabeledField label="Via *" tone="siaps">
              <select value={routeId} onChange={(e) => setRoute(e.target.value)}>
                {(catalog?.routes || []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>
            </LabeledField>
            <LabeledField label="Local de aplicação *" tone="siaps">
              <select value={siteId} onChange={(e) => setSite(e.target.value)}>
                {(catalog?.sites || []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>
            </LabeledField>
          </div>

          {isSpecial ? (
            <div className="alert">
              <strong>Estratégia Especial</strong> — CBO e CID-10 obrigatórios.
              <div className="grid-2" style={{ marginTop: 8 }}>
                <LabeledField label="CBO do solicitante *" tone="siaps">
                  <input className="mono" required value={prescriberCbo} onChange={(e) => setCbo(e.target.value)} />
                </LabeledField>
                <LabeledField label="CID-10 da indicação *" tone="siaps">
                  <input className="mono" required value={indicationCid10} onChange={(e) => setCid(e.target.value)} />
                </LabeledField>
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

      {tab === 'estoque' ? (
        <div className="stack">
          <div className="alert">
            <strong>Estoque / cadeia de frio (beyond-MVP)</strong>
            <p style={{ margin: '6px 0 0' }}>
              {catalog?.stock?.note ||
                'Lote, equipamento frio, caixa térmica, leitura manual °C e insumos leves. Baixa automática na aplicação; void devolve.'}
            </p>
            <p style={{ margin: '8px 0 0', color: 'var(--ink-3)' }}>
              <strong>Não é:</strong>{' '}
              {(catalog?.stock?.notIncluded || ['Monitoramento contínuo de geladeira (IoT)']).join(' · ')}
            </p>
          </div>

          <form className="card" onSubmit={onStockSubmit} style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Entrada de lote</h3>
            <div className="grid-2">
              <div className="field">
                <label>Imunobiológico *</label>
                <select value={stockImm} onChange={(e) => setStockImm(e.target.value)}>
                  {(catalog?.immunobiologicals || []).map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Lote *</label>
                <input
                  className="mono"
                  required
                  value={stockLot}
                  onChange={(e) => setStockLot(e.target.value)}
                  maxLength={30}
                />
              </div>
              <div className="field">
                <label>Fabricante</label>
                <input value={stockMfr} onChange={(e) => setStockMfr(e.target.value)} />
              </div>
              <div className="field">
                <label>Validade</label>
                <input type="date" value={stockExpiry} onChange={(e) => setStockExpiry(e.target.value)} />
              </div>
              <div className="field">
                <label>Quantidade (doses) *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Equipamento frio</label>
                <select value={stockColdEq} onChange={(e) => setStockColdEq(e.target.value)}>
                  <option value="">Opcional…</option>
                  {coldEqs.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.code} — {eq.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Sala / geladeira (rótulo)</label>
                <input
                  value={stockRoom}
                  onChange={(e) => setStockRoom(e.target.value)}
                  placeholder="ex.: Geladeira sala vacina 1"
                />
              </div>
              <div className="field">
                <label>Temp. alvo mín (°C)</label>
                <input value={stockTempMin} onChange={(e) => setStockTempMin(e.target.value)} />
              </div>
              <div className="field">
                <label>Temp. alvo máx (°C)</label>
                <input value={stockTempMax} onChange={(e) => setStockTempMax(e.target.value)} />
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy || !facilityId}>
              {busy ? 'Salvando…' : 'Entrada de estoque'}
            </button>
          </form>

          <div className="table-wrap" style={{ marginBottom: 16 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Imuno</th>
                  <th>Lote</th>
                  <th>Qty</th>
                  <th>Validade</th>
                  <th>°C alvo</th>
                  <th>Equipamento / sala</th>
                </tr>
              </thead>
              <tbody>
                {stockRows.map((s) => (
                  <tr key={s.id}>
                    <td>{s.immunobiologicalId}</td>
                    <td className="mono">{s.lot}</td>
                    <td className="mono">
                      {s.quantity} {s.unit}
                    </td>
                    <td className="mono">{s.expiresAt ? String(s.expiresAt).slice(0, 10) : '—'}</td>
                    <td className="mono">
                      {s.targetTempMinC != null || s.targetTempMaxC != null
                        ? `${s.targetTempMinC ?? '?'}–${s.targetTempMaxC ?? '?'} °C`
                        : '—'}
                    </td>
                    <td>
                      {s.coldEquipment
                        ? `${s.coldEquipment.code} — ${s.coldEquipment.label}`
                        : s.roomLabel || '—'}
                    </td>
                  </tr>
                ))}
                {!stockRows.length ? (
                  <TableStateRow
                    colSpan={6}
                    empty={facilityId ? 'Sem lotes de estoque nesta unidade.' : 'Selecione uma unidade.'}
                  />
                ) : null}
              </tbody>
            </table>
          </div>

          <form className="card" onSubmit={onColdEqSubmit} style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Equipamento frio (RF-14.17)</h3>
            <div className="grid-2">
              <div className="field">
                <label>Código *</label>
                <input className="mono" required value={eqCode} onChange={(e) => setEqCode(e.target.value)} />
              </div>
              <div className="field">
                <label>Nome *</label>
                <input required value={eqLabel} onChange={(e) => setEqLabel(e.target.value)} />
              </div>
              <div className="field">
                <label>Tipo</label>
                <select value={eqKind} onChange={(e) => setEqKind(e.target.value)}>
                  <option value="REFRIGERATOR">Geladeira</option>
                  <option value="FREEZER">Freezer</option>
                  <option value="COLD_ROOM">Câmara fria</option>
                </select>
              </div>
              <div className="field">
                <label>Faixa °C</label>
                <div className="row" style={{ gap: 8 }}>
                  <input value={eqMin} onChange={(e) => setEqMin(e.target.value)} style={{ width: 72 }} />
                  <span>–</span>
                  <input value={eqMax} onChange={(e) => setEqMax(e.target.value)} style={{ width: 72 }} />
                </div>
              </div>
            </div>
            <button className="btn btn-secondary" type="submit" disabled={busy || !facilityId}>
              Cadastrar equipamento
            </button>
            {coldEqs.length ? (
              <p style={{ marginTop: 10, color: 'var(--ink-3)' }}>
                {coldEqs.map((eq) => `${eq.code} (${eq.kind}, ${eq.targetTempMinC}–${eq.targetTempMaxC}°C)`).join(' · ')}
              </p>
            ) : null}
          </form>

          <form className="card" onSubmit={onBoxSubmit} style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Caixa térmica (RF-14.18)</h3>
            <div className="grid-2">
              <div className="field">
                <label>Código *</label>
                <input className="mono" required value={boxCode} onChange={(e) => setBoxCode(e.target.value)} />
              </div>
              <div className="field">
                <label>Nome *</label>
                <input required value={boxLabel} onChange={(e) => setBoxLabel(e.target.value)} />
              </div>
              <div className="field">
                <label>Guardada em</label>
                <select value={boxEq} onChange={(e) => setBoxEq(e.target.value)}>
                  <option value="">Opcional…</option>
                  {coldEqs.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.code} — {eq.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button className="btn btn-secondary" type="submit" disabled={busy || !facilityId}>
              Cadastrar caixa
            </button>
            {thermalBoxes.length ? (
              <p style={{ marginTop: 10, color: 'var(--ink-3)' }}>
                {thermalBoxes.map((b) => `${b.code} (${b.status})`).join(' · ')}
              </p>
            ) : null}
          </form>

          <form className="card" onSubmit={onTempSubmit} style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Leitura manual de temperatura (RF-14.19)</h3>
            <div className="grid-2">
              <div className="field">
                <label>Equipamento</label>
                <select value={readEq} onChange={(e) => setReadEq(e.target.value)}>
                  <option value="">—</option>
                  {coldEqs.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Caixa térmica</label>
                <select value={readBox} onChange={(e) => setReadBox(e.target.value)}>
                  <option value="">—</option>
                  {thermalBoxes.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Temperatura (°C) *</label>
                <input required value={readTemp} onChange={(e) => setReadTemp(e.target.value)} />
              </div>
            </div>
            <button className="btn btn-secondary" type="submit" disabled={busy || !facilityId}>
              Registrar leitura
            </button>
            {tempReadings.length ? (
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Quando</th>
                      <th>Onde</th>
                      <th>°C</th>
                      <th>Faixa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tempReadings.slice(0, 8).map((r) => (
                      <tr key={r.id}>
                        <td className="mono">{formatDateTime(r.recordedAt)}</td>
                        <td>
                          {r.coldEquipment?.code || r.thermalBox?.code || '—'}
                        </td>
                        <td className="mono">{r.temperatureC}</td>
                        <td>{r.withinRange ? 'OK' : 'FORA'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </form>

          <form className="card" onSubmit={onSupplySubmit} style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Insumos leves (RF-14.4 / 14.6)</h3>
            <div className="grid-2">
              <div className="field">
                <label>SKU *</label>
                <input className="mono" required value={supSku} onChange={(e) => setSupSku(e.target.value)} />
              </div>
              <div className="field">
                <label>Nome *</label>
                <input required value={supLabel} onChange={(e) => setSupLabel(e.target.value)} />
              </div>
              <div className="field">
                <label>Quantidade *</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={supQty}
                  onChange={(e) => setSupQty(e.target.value)}
                />
              </div>
            </div>
            <button className="btn btn-secondary" type="submit" disabled={busy || !facilityId}>
              Registrar insumo
            </button>
          </form>

          <form className="card" onSubmit={onLinkSubmit} style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Vínculo imuno → insumo</h3>
            <div className="grid-2">
              <div className="field">
                <label>Imunobiológico</label>
                <select value={linkImm} onChange={(e) => setLinkImm(e.target.value)}>
                  {(catalog?.immunobiologicals || []).map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Insumo</label>
                <select value={linkSupplyId} onChange={(e) => setLinkSupplyId(e.target.value)}>
                  <option value="">Selecionar…</option>
                  {supplies.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.sku} — {s.label} ({s.quantity} {s.unit})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button className="btn btn-secondary" type="submit" disabled={busy || !linkSupplyId}>
              Vincular (1 un/dose)
            </button>
            {supplies.length ? (
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Nome</th>
                      <th>Qty</th>
                      <th>Vínculos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplies.map((s) => (
                      <tr key={s.id}>
                        <td className="mono">{s.sku}</td>
                        <td>{s.label}</td>
                        <td className="mono">
                          {s.quantity} {s.unit}
                        </td>
                        <td>
                          {(s.links || []).map((l) => `${l.immunobiologicalId}×${l.qtyPerDose}`).join(', ') ||
                            '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </form>
        </div>
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
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {todayRows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{formatDateTime(r.appliedAt)}</td>
                  <td>{displayPatientName(r.patient)}</td>
                  <td>{r.status || '—'}</td>
                  <td>
                    {r.status !== 'VOID' ? (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={busy}
                        onClick={() => {
                          void (async () => {
                            if (!window.confirm('Anular aplicação localmente (sem recall Siaps)?')) return;
                            setBusy(true);
                            setError(null);
                            try {
                              await api(`/v1/vaccinations/${r.id}/void`, {
                                method: 'POST',
                                json: { acknowledgeLocalOnly: true, reason: 'Anulação pela lista do dia' },
                              });
                              setOk('Aplicação anulada (VOID local).');
                              await load();
                            } catch (e) {
                              setError(e instanceof Error ? e.message : 'Falha ao anular');
                            } finally {
                              setBusy(false);
                            }
                          })();
                        }}
                      >
                        Anular
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!todayRows.length ? (
                <TableStateRow
                  colSpan={4}
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
