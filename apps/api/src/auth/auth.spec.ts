import * as bcrypt from 'bcryptjs';
import { ROLE_SEEDS, PERMISSIONS } from './roles.seed';

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
