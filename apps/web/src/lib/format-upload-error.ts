/** Normaliza erros de upload para nunca mostrar o inglês cru do Safari/Chrome. */

import { isIoReadError } from '@/lib/read-binary-file';

export function formatUploadError(err: unknown): string {
  if (isIoReadError(err)) {
    if (err instanceof Error && /Escolher de novo|Desktop/i.test(err.message)) {
      return err.message;
    }
    return (
      'O navegador bloqueou a leitura do arquivo (Downloads/iCloud). ' +
      'Clique em “Escolher de novo”, ou copie o .zip para o Desktop (fora do iCloud) e selecione de lá.'
    );
  }
  return err instanceof Error ? err.message : String(err || 'Falha no upload');
}

export { isIoReadError };
