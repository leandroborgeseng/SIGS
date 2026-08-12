/** Código IBGE do município (7 dígitos) para header LEDI. */

export function normalizeIbgeCode(raw?: string | null): string | null {
  if (raw == null || String(raw).trim() === '') return null;
  const digits = String(raw).replace(/\D/g, '');
  return digits || null;
}

export function assertIbgeCode(raw?: string | null): string | null {
  const code = normalizeIbgeCode(raw);
  if (code == null) return null;
  if (!/^\d{7}$/.test(code)) {
    throw new Error('código IBGE do município deve ter 7 dígitos');
  }
  return code;
}

/** Preferência: cadastro da unidade → env SIGS_IBGE_MUNICIPIO. */
export function resolveCodigoIbgeMunicipio(facilityIbge?: string | null): string | null {
  try {
    return (
      assertIbgeCode(facilityIbge) ||
      assertIbgeCode(process.env.SIGS_IBGE_MUNICIPIO) ||
      null
    );
  } catch {
    return normalizeIbgeCode(facilityIbge) || normalizeIbgeCode(process.env.SIGS_IBGE_MUNICIPIO);
  }
}
