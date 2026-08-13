import * as bcrypt from 'bcryptjs';
import { ROLE_SEEDS, PERMISSIONS } from './roles.seed';
import { resolveSeedAdminCredentials } from './seed-admin';

describe('auth roles seed', () => {
  it('TI tem permissão total', () => {
    const ti = ROLE_SEEDS.find((r) => r.code === 'TI');
    expect(ti?.permissions).toContain(PERMISSIONS.ALL);
  });

  it('RECEPCAO não tem reports', () => {
    const r = ROLE_SEEDS.find((x) => x.code === 'RECEPCAO');
    expect(r?.permissions).not.toContain(PERMISSIONS.REPORTS);
  });
});

describe('bcrypt login hash', () => {
  it('valida senha', async () => {
    const hash = await bcrypt.hash('admin123', 10);
    expect(await bcrypt.compare('admin123', hash)).toBe(true);
    expect(await bcrypt.compare('wrong', hash)).toBe(false);
  });
});

describe('resolveSeedAdminCredentials', () => {
  it('dev usa default fraco se ausente', () => {
    const r = resolveSeedAdminCredentials({ NODE_ENV: 'development' } as NodeJS.ProcessEnv);
    expect(r.email).toBe('admin@sigs.local');
    expect(r.password).toBe('admin123');
  });

  it('production recusa senha curta e não retorna default', () => {
    const r = resolveSeedAdminCredentials({
      NODE_ENV: 'production',
      SEED_ADMIN_PASSWORD: 'admin123',
    } as NodeJS.ProcessEnv);
    expect(r.password).toBeNull();
    expect(r.refuseReason).toMatch(/SEED_ADMIN_PASSWORD/);
  });

  it('production aceita senha ≥12', () => {
    const r = resolveSeedAdminCredentials({
      NODE_ENV: 'production',
      SEED_ADMIN_EMAIL: 'ops@franca.sp.gov.br',
      SEED_ADMIN_PASSWORD: 'senha-forte-12',
    } as NodeJS.ProcessEnv);
    expect(r.email).toBe('ops@franca.sp.gov.br');
    expect(r.password).toBe('senha-forte-12');
  });
});
