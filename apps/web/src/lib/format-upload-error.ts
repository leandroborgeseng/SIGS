/** Normaliza erros de upload — mensagem honesta, sem culpar iCloud por padrão. */

import { ApiError, isNetworkError, NetworkError } from '@/lib/api';
import { isIoReadError } from '@/lib/read-binary-file';
import { isLediTipoMismatchError } from '@/lib/ledi-xml-batch';
import { isChunkUploadError } from '@/lib/ledi-batch-upload';

function formatMb(bytes?: number): string | null {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return null;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatUploadError(err: unknown): string {
  if (isChunkUploadError(err)) {
    const cause = (err as Error & { cause?: unknown }).cause;
    if (isIoReadError(cause)) {
      return cause instanceof Error
        ? cause.message
        : 'O Safari falhou ao ler o arquivo. Escolha de novo pelo botão, ou envie via Chrome/Edge. No Mac: node tools/split-ledi-zip.cjs <arquivo.zip>.';
    }
    const extra =
      cause instanceof ApiError
        ? ` Detalhe HTTP ${cause.status}: ${cause.message}`
        : cause instanceof Error && cause.message && cause.message !== err.message
          ? ` Detalhe: ${cause.message}`
          : '';
    return err.message + extra;
  }
  if (isLediTipoMismatchError(err)) {
    return err instanceof Error ? err.message : 'Tipo LEDI não corresponde a esta tela.';
  }
  if (err instanceof NetworkError || isNetworkError(err)) {
    if (err instanceof NetworkError) return err.message;
    const bytes = (err as { bytesHint?: number }).bytesHint;
    const size = formatMb(bytes);
    const small = typeof bytes === 'number' && bytes < 1024 * 1024;
    return (
      `Falha de rede no envio (sem resposta HTTP — “Load failed” / “Failed to fetch”).` +
      (size
        ? small
          ? ` O corpo era pequeno (${size}) — não é limite de tamanho.`
          : ` Payload ≈ ${size}.`
        : '') +
      (small
        ? ` A conexão foi fechada pelo proxy/API. Recarregue e envie de novo; se persistir, a API pode estar fora do ar.`
        : ` A conexão caiu antes de uma resposta HTTP (timeout do gateway, rede ou processo derrubado). Tente de novo; se persistir, verifique a rede ou envie um ZIP menor.`)
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
        `O ZIP grande sobe em partes; XMLs soltos em lotes pequenos. ` +
        `Recarregue a página após o deploy e envie de novo; se persistir, verifique a rede.`
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
