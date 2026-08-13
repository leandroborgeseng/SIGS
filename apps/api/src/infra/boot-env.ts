/**
 * Validação fail-fast de variáveis de ambiente no boot (API / worker).
 * Mensagens amigáveis para logs Railway/Coolify — sem vazar secrets.
 */

const WEAK_JWT = new Set([
  '',
  'change-me-in-production',
  'troque-em-producao',
  'troque-por-uma-string-longa-aleatoria-32chars',
  'sigs-dev-secret-change-me',
  'dev-change-me',
]);

export type BootRole = 'api' | 'worker';

function isProduction(): boolean {
  return (process.env.NODE_ENV || '').toLowerCase() === 'production';
}

/** Host/db sem user:pass — só para log. */
export function redactDatabaseUrl(url: string | undefined): string {
  if (!url) return 'unset';
  try {
    const u = new URL(url);
    const db = u.pathname.replace(/^\//, '') || '?';
    return `${u.hostname}:${u.port || '5432'}/${db.split('?')[0]}`;
  } catch {
    return url.includes('@') ? url.replace(/^[^@]+@/, '') : '(url inválida)';
  }
}

export function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim() || '';
  if (secret && !WEAK_JWT.has(secret)) return secret;
  if (!isProduction()) {
    return secret || 'sigs-dev-secret-change-me';
  }
  return secret;
}

/**
 * Valida env obrigatório. Em falha: loga e process.exit(1).
 * Redis é opcional na API (fila inline); obrigatório só no worker.
 */
export function assertBootEnv(role: BootRole = 'api'): void {
  const errors: string[] = [];
  const warnings: string[] = [];
  const prod = isProduction();

  const db = process.env.DATABASE_URL?.trim();
  if (!db) {
    errors.push(
      'DATABASE_URL ausente. No Railway: Variables → Add Reference → Postgres → DATABASE_URL (não use file:...).',
    );
  } else if (db.startsWith('file:')) {
    errors.push(
      `DATABASE_URL aponta para SQLite (${db.slice(0, 32)}…). Em deploy use PostgreSQL do plugin Railway.`,
    );
  }

  const jwt = process.env.JWT_SECRET?.trim() || '';
  if (!jwt) {
    if (prod) {
      errors.push(
        'JWT_SECRET ausente. Defina uma string longa aleatória (≥32 chars) nas Variables do Railway.',
      );
    } else {
      warnings.push('JWT_SECRET ausente — usando segredo de desenvolvimento (não use em produção).');
    }
  } else if (WEAK_JWT.has(jwt) || jwt.length < 16) {
    if (prod) {
      errors.push(
        'JWT_SECRET fraco ou placeholder. Troque por string aleatória ≥32 caracteres antes do deploy.',
      );
    } else {
      warnings.push('JWT_SECRET fraco/placeholder — ok só em dev.');
    }
  }

  if (role === 'worker') {
    if (!process.env.REDIS_URL?.trim()) {
      errors.push(
        'REDIS_URL obrigatório para PROCESS_ROLE=worker. Sem Redis, use PROCESS_ROLE=api|all (fila inline).',
      );
    }
  } else if (!process.env.REDIS_URL?.trim()) {
    warnings.push(
      'REDIS_URL ausente — BullMQ desligado; jobs LEDI/SIGTAP rodam inline no processo da API.',
    );
  }

  const line = `SIGS ${role} boot · NODE_ENV=${process.env.NODE_ENV || 'undefined'} · DB=${redactDatabaseUrl(db)} · queue=${process.env.REDIS_URL?.trim() ? 'redis' : 'inline'}`;
  // eslint-disable-next-line no-console
  console.log(line);

  for (const w of warnings) {
    // eslint-disable-next-line no-console
    console.warn(`WARN: ${w}`);
  }

  if (errors.length) {
    // eslint-disable-next-line no-console
    console.error('SIGS boot abortado — corrija as variáveis e faça redeploy:\n');
    for (const e of errors) {
      // eslint-disable-next-line no-console
      console.error(`  • ${e}`);
    }
    // eslint-disable-next-line no-console
    console.error('');
    process.exit(1);
  }
}
