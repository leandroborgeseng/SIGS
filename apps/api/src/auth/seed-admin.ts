/** Credenciais do admin seed — defaults fracos só em desenvolvimento. */

export const SEED_ADMIN_PASSWORD_MIN_PROD = 12;

export type SeedAdminCredentials = {
  email: string;
  /** null = não criar admin (produção sem senha forte). */
  password: string | null;
  refuseReason?: string;
};

function isProduction(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.NODE_ENV || '').toLowerCase() === 'production';
}

/**
 * Resolve e-mail/senha do admin seed.
 * Em production: exige `SEED_ADMIN_PASSWORD` com ≥12 chars; senão não embute default fraco.
 * Em development: fallback `admin@sigs.local` / `admin123`.
 */
export function resolveSeedAdminCredentials(
  env: NodeJS.ProcessEnv = process.env,
): SeedAdminCredentials {
  const email = (env.SEED_ADMIN_EMAIL || 'admin@sigs.local').trim().toLowerCase();
  const raw = env.SEED_ADMIN_PASSWORD?.trim() || '';
  const prod = isProduction(env);

  if (prod) {
    if (!raw || raw.length < SEED_ADMIN_PASSWORD_MIN_PROD) {
      return {
        email,
        password: null,
        refuseReason:
          `SEED_ADMIN_PASSWORD ausente ou curta (<${SEED_ADMIN_PASSWORD_MIN_PROD}) em production — ` +
          'admin seed NÃO será criado. Defina senha forte nas Variables do Railway e redeploy ' +
          '(deploys com admin já existente não são afetados).',
      };
    }
    return { email, password: raw };
  }

  return { email, password: raw || 'admin123' };
}
