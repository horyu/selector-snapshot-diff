import { acceptTypes, maxBytes } from './slots';

export type ImageValidationError =
  | { code: 'unsupported_type'; fileType: string }
  | { code: 'size_exceeded'; limitBytes: number };

export type ImageValidationResult =
  | { ok: true }
  | { ok: false; error: ImageValidationError };

const ACCEPTED_TYPE_MESSAGE = '画像ファイル（png/jpeg/webp）を指定してください';

const formatSizeLimit = (bytes: number): string =>
  `${(bytes / (1024 * 1024)).toFixed(0)}MB`;

export const ACCEPTED_IMAGE_MESSAGE = ACCEPTED_TYPE_MESSAGE;

export function validateImageFile(file: File): ImageValidationResult {
  if (!acceptTypes.has(file.type)) {
    return {
      ok: false,
      error: { code: 'unsupported_type', fileType: file.type || 'unknown' },
    };
  }
  if (file.size > maxBytes) {
    return {
      ok: false,
      error: { code: 'size_exceeded', limitBytes: maxBytes },
    };
  }
  return { ok: true };
}

export function formatImageValidationError(
  error: ImageValidationError
): string {
  if (error.code === 'unsupported_type') {
    return `未対応の形式: ${error.fileType}`;
  }
  if (error.code === 'size_exceeded') {
    return `ファイルサイズ超過（上限 ${formatSizeLimit(error.limitBytes)}）`;
  }
  return ACCEPTED_TYPE_MESSAGE;
}
