'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, OkBox, PageHeader, TableStateRow } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';

type Role = { id: string; code: string; name: string };
type User = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  roleName: string;
  roleId: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([api<User[]>('/v1/users'), api<Role[]>('/v1/roles')]);
      setUsers(u);
      setRoles(r);
      if (!roleId && r[0]) setRoleId(r[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sem permissão ou falha ao listar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createUser(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    try {
      await api('/v1/users', { method: 'POST', json: { name, email, password, roleId } });
      setName('');
      setEmail('');
      setPassword('');
      setOk('Usuário criado.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar');
    }
  }

  return (
    <AppShell helpId="admin.usuarios">
      <PageHeader
        title="Usuários"
        eyebrow="Administração"
        description="Gestão de contas (requer permissão de usuários)."
        actions={<HelpLink id="admin.usuarios" />}
      />
      <ErrorBox message={error} />
      <OkBox message={ok} />
      <form className="card grid-2" onSubmit={createUser} style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Nome</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>E-mail</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Senha</label>
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="field">
          <label>Perfil</label>
          <select required value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" type="submit">
          Criar usuário
        </button>
      </form>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Perfil</th>
              <th>Ativo</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.roleName}</td>
                <td>{u.active ? 'Sim' : 'Não'}</td>
              </tr>
            ))}
            {!users.length ? (
              <TableStateRow colSpan={4} loading={loading} empty="Nenhum usuário listado." />
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
