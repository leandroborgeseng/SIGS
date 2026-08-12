'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, PageHeader, TableStateRow } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { displayPatientName, formatDate } from '@/lib/labels';

type Patient = {
  id: string;
  civilName: string;
  socialName?: string | null;
  cpf?: string | null;
  cns?: string | null;
  birthDate: string;
};

export default function PatientsPage() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Patient[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function search(term = q) {
    setError(null);
    try {
      const data = await api<Patient[]>(`/v1/patients${term ? `?q=${encodeURIComponent(term)}` : ''}`);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na busca');
    }
  }

  useEffect(() => {
    void search('');
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void search();
  }

  return (
    <AppShell helpId="cadastros.pacientes">
      <PageHeader
        title="Pacientes"
        eyebrow="Cadastros"
        description="Busca por nome, CPF ou CNS. Nome social aparece junto ao nome de registro."
        actions={
          <>
            <HelpLink id="cadastros.pacientes" />
            <Link className="btn btn-primary" href="/pacientes/novo">
              + Novo paciente
            </Link>
          </>
        }
      />
      <ErrorBox message={error} />
      <form className="card row" onSubmit={onSubmit} style={{ marginBottom: 12 }}>
        <input
          style={{ flex: 1, minHeight: 44, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)' }}
          placeholder="Buscar por nome, CPF ou CNS"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn btn-primary" type="submit">
          Buscar
        </button>
      </form>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Nome</th>
              <th>CPF</th>
              <th>CNS</th>
              <th>Nascimento</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{displayPatientName(p)}</td>
                <td className="mono">{p.cpf || '—'}</td>
                <td className="mono">{p.cns || '—'}</td>
                <td className="mono">{formatDate(p.birthDate)}</td>
                <td>
                  <Link href={`/pacientes/${p.id}`}>Abrir</Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <TableStateRow colSpan={5} empty="Nenhum paciente encontrado. Ajuste a busca ou cadastre um novo." />
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
