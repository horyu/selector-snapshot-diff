import type { SlotSource } from '../history/history';

export type ItemInfo = {
  url: string;
  name: string;
  type: string;
  file: File;
  label: string;
};

export type SlotItem = ItemInfo & { source: SlotSource };
export type ImgSlot = SlotItem | null;

export const acceptTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
export const maxBytes = 20 * 1024 * 1024; // 20MB

export function makeItem(
  file: File,
  options: { labelOverride?: string; defaultName?: string } = {}
): ItemInfo {
  const url = URL.createObjectURL(file);
  const baseName =
    (file.name && file.name.trim()) ||
    (options.defaultName && options.defaultName.trim()) ||
    'screenshot.png';
  const label =
    (options.labelOverride && options.labelOverride.trim()) ||
    baseName ||
    'screenshot';
  return { url, name: baseName, type: file.type, file, label };
}

export function revokeItem(item: { url?: string } | null | undefined) {
  try {
    if (item && item.url) URL.revokeObjectURL(item.url);
  } catch {
    /* ignore */
  }
}
