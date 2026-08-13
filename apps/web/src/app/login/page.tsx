'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { ErrorBox } from '@/components/ui/PageHeader';

/** Em produção (ou com flag) não embute credenciais seed no HTML. */
const hideSeedCredentials =
  process.env.NODE_ENV === 'production' ||
  process.env.NEXT_PUBLIC_HIDE_SEED_CREDENTIALS === '1';

const DEV_SEED_EMAIL = 'admin@sigs.local';
const DEV_SEED_PASSWORD = 'admin123';

export default function LoginPage() {
  const { login, user, facilityId } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState(hideSeedCredentials ? '' : DEV_SEED_EMAIL);
  const [password, setPassword] = useState(hideSeedCredentials ? '' : DEV_SEED_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace(facilityId ? '/dashboard' : '/selecionar-unidade');
  }, [user, facilityId, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      router.push('/selecionar-unidade');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha no login');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-split sgs-screen">
      <section className="login-form-wrap">
        <form className="login-form" onSubmit={onSubmit}>
          <div className="login-brand-mark">
            <img src="/brand/franca-mark.png" alt="" />
            <div>
              <strong>SIGS Franca</strong>
              <span>Sistema de Informação em Gestão de Saúde</span>
            </div>
          </div>
          <h1>Acessar o sistema</h1>
          <p>Use suas credenciais institucionais da Secretaria de Saúde.</p>
          <ErrorBox message={error} />
          <div className="field">
            <label htmlFor="email">E-mail ou usuário</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', minHeight: 44 }}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
          {!hideSeedCredentials ? (
            <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--ink-3)', marginTop: 16 }}>
              Dev seed: <b style={{ color: 'var(--ink-2)' }}>{DEV_SEED_EMAIL}</b> /{' '}
              <b style={{ color: 'var(--ink-2)' }}>{DEV_SEED_PASSWORD}</b>
            </p>
          ) : null}
        </form>
      </section>
      <section className="login-brand">
        <div className="eyebrow">Atenção Primária à Saúde · Franca/SP</div>
        <div>
          <h2>Gestão clínica e operacional das unidades de saúde do município.</h2>
          <p>
            Agenda, atendimento, vacinação e prontuário em um só lugar — pensado para o dia a dia da
            recepção, enfermagem e equipe médica.
          </p>
        </div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Secretaria Municipal de Saúde de Franca/SP</div>
      </section>
    </div>
  );
}
