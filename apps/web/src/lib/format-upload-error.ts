/** Normaliza erros de upload — mensagem honesta, sem culpar iCloud por padrão. */

import { ApiError, isNetworkError, NetworkError } from '@/lib/api';
import { isIoReadError } from '@/lib/read-binary-file';

function formatMb(bytes?: number): string | null {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return null;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatUploadError(err: unknown): string {
  if (err instanceof NetworkError || isNetworkError(err)) {
    if (err instanceof NetworkError) return err.message;
    const size = formatMb((err as { bytesHint?: number }).bytesHint);
    return (
      `Falha de rede no envio (sem resposta HTTP — “Load failed” / “Failed to fetch”).` +
      (size ? ` Payload ≈ ${size}.` : '') +
      ` A conexão caiu antes de uma resposta HTTP (timeout do gateway, rede ou processo derrubado). Tente de novo; se persistir, verifique a rede ou envie um ZIP menor.`
    );
  }

  if (err instanceof ApiError) {
    if (err.status === 413) {
      return `Servidor recusou o arquivo (HTTP 413 — corpo grande demais): ${err.message}`;
    }
    if (err.status === 502 || err.status === 504) {
      return `Proxy/gateway falhou (HTTP ${err.status}). O upload pode ter estourado timeout — tente ZIP menor ou envie de novo.`;
    }
    if (/unexpected end of form|boundary not found/i.test(err.message)) {
      return (
        `Falha no envio (HTTP ${err.status}): multipart incompleto (${err.message}). ` +
        `O ZIP chegou truncado na API (conexão cortada, timeout do gateway Railway, ou Content-Type sem boundary). ` +
        `Não é o clone 10 MB do rewrite Next — o upload LEDI vai em stream. Tente de novo; se persistir, verifique a rede ou envie um ZIP menor.`
      );
    }
    return `Falha no envio (HTTP ${err.status}): ${err.message}`;
  }

  if (isIoReadError(err)) {
    return err instanceof Error ? err.message : 'Falha ao ler o arquivo no navegador.';
  }

  if (err instanceof Error) {
    const msg = err.message || '';
    if (/load failed|failed to fetch/i.test(msg)) {
      return (
        `Falha de rede no envio (sem resposta HTTP — “${msg}”).` +
        ` Provável: corpo grande, timeout ou conexão interrompida. Tente de novo com o mesmo arquivo.`
      );
    }
    return msg;
  }

  return String(err || 'Falha no upload');
}

export { isIoReadError, isNetworkError };
