import type { SlotSource } from './history';

const JAPANESE_DATETIME_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export function formatHistoryTimestamp(timestamp: number): string {
  try {
    return JAPANESE_DATETIME_FORMATTER.format(new Date(timestamp));
  } catch {
    const fallback = new Date(timestamp);
    return Number.isFinite(fallback.getTime()) ? fallback.toLocaleString() : '';
  }
}

export function formatHistoryBytes(bytes: number | undefined): string {
  if (!Number.isFinite(bytes) || !bytes || bytes <= 0) {
    return '';
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

export function describeHistorySource(source: SlotSource): string {
  switch (source.kind) {
    case 'upload':
      return 'ファイルアップロード';
    case 'paste':
      return 'クリップボード';
    case 'playwright':
      return 'Playwright';
    default:
      return '';
  }
}

export function isPlaywrightHistorySource(
  source: SlotSource
): source is Extract<SlotSource, { kind: 'playwright' }> {
  return source.kind === 'playwright';
}

export function summarizePlaywrightHistoryUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname || '/';
    const search = parsed.search ?? '';
    const hash = parsed.hash ?? '';
    return `${parsed.host}${pathname}${search}${hash}`;
  } catch {
    return url.replace(/^[a-z]+:\/\//i, '');
  }
}

export function getPlaywrightHistorySelector(
  source: Extract<SlotSource, { kind: 'playwright' }>
): string {
  return source.payload.selector ?? '';
}
