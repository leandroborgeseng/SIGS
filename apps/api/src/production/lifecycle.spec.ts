import { assertTransition, canTransition, isBatchStatus } from './lifecycle';

describe('production lifecycle', () => {
  it('permite draft→ready→sent e error→ready', () => {
    expect(canTransition('draft', 'ready')).toBe(true);
    expect(canTransition('ready', 'sent')).toBe(true);
    expect(canTransition('ready', 'error')).toBe(true);
    expect(canTransition('error', 'ready')).toBe(true);
    expect(canTransition('sent', 'ready')).toBe(true);
  });

  it('bloqueia sent→error e draft→sent', () => {
    expect(canTransition('sent', 'error')).toBe(false);
    expect(canTransition('draft', 'sent')).toBe(false);
    expect(() => assertTransition('draft', 'sent')).toThrow(/inválida/);
  });

  it('reconhece status conhecidos', () => {
    expect(isBatchStatus('ready')).toBe(true);
    expect(isBatchStatus('foo')).toBe(false);
  });
});
