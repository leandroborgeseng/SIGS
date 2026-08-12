/** Normaliza erros de upload para nunca mostrar o inglês cru do Safari/Chrome. */

export function formatUploadError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err || 'Falha no upload');
  if (/I\/O read operation failed|NotReadableError/i.test(msg)) {
    return (
      'O navegador bloqueou a leitura do arquivo (Downloads/iCloud). ' +
      'Abra o Finder → copie o .zip para a pasta do projeto tmp/ledi-upload (ou Desktop) → ' +
      'arraste esse arquivo daí. Alternativa: node tools/upload-ledi-lote.cjs ./tmp/ledi-upload/fai.zip --tipo FAI'
    );
  }
  return msg;
}
