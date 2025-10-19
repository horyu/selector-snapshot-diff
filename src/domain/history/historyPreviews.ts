import type { HistoryEntry } from './history';

export type HistoryPreviewMap = Record<string, string>;

export function clearHistoryPreviews(
  map: HistoryPreviewMap
): HistoryPreviewMap {
  for (const url of Object.values(map)) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
  return {};
}

export function buildHistoryPreviews(
  entries: HistoryEntry[]
): HistoryPreviewMap {
  const result: HistoryPreviewMap = {};
  for (const entry of entries) {
    try {
      result[entry.id] = URL.createObjectURL(entry.image.blob);
    } catch {
      /* ignore */
    }
  }
  return result;
}
