import { corsOriginOption } from './cors-origin';

describe('corsOriginOption', () => {
  it('reflecte Origin quando * (compatível com credentials)', () => {
    expect(corsOriginOption('*')).toBe(true);
    expect(corsOriginOption('')).toBe(true);
    expect(corsOriginOption(' * ')).toBe(true);
  });

  it('aceita um domínio ou lista', () => {
    expect(corsOriginOption('https://sigs-production.up.railway.app')).toBe(
      'https://sigs-production.up.railway.app',
    );
    expect(corsOriginOption('https://a.example, https://b.example')).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });
});
