/**
 * Tetos do upload ZIP LEDI. A UI envia fatias de 512 KiB; o total montado
 * (e o multipart legado) não pode passar de 100 MB.
 */
export const LEDI_ZIP_MAX_BYTES = 100 * 1024 * 1024;
/** Fatia octet-stream da UI / CLI — cabe no raw-body de 2mb. */
export const LEDI_ZIP_CHUNK_BYTES = 512 * 1024;
/** 100 MB / 512 KiB = 200; margem para fatia menor no fim. */
export const LEDI_ZIP_MAX_CHUNKS = 256;
export const LEDI_ZIP_MAX_LABEL = '100 MB';
