/**
 * `CORS_ORIGIN=*` + `credentials: true` é inválido no browser
 * (Safari reporta “Load failed” sem HTTP). Reflecte o Origin da request.
 */
export function corsOriginOption(raw?: string): boolean | string | string[] {
  const v = String(raw ?? 'http://localhost:3000').trim();
  if (!v || v === '*') return true;
  const list = v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!list.length || list.includes('*')) return true;
  return list.length === 1 ? list[0]! : list;
}
