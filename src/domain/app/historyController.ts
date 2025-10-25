import type { HistoryEntry, SlotSource } from '../history/history';
import {
  addHistorySnapshot,
  clearAllHistoryEntries,
  historyEntriesSubscribe,
  isHistoryLoaded as historyStoreLoaded,
  loadHistoryEntries,
  removeHistoryEntry,
  type HistoryUnsubscriber,
} from '../history/historyStore';
import {
  buildHistoryPreviews,
  clearHistoryPreviews,
  type HistoryPreviewMap,
} from '../history/historyPreviews';
import { createFileFromStored, toSlotSnapshot } from '../history/historyFiles';
import type { ImgSlot } from '../slots/slots';

export type PreviewImage = {
  src: string;
  label: string;
  cleanup?: () => void;
};

type SlotSetter = (
  slot: 'left' | 'right',
  file: File,
  options: { label: string; source: SlotSource }
) => void;

export type HistoryControllerAdapters = {
  getEntries: () => HistoryEntry[];
  setEntries: (entries: HistoryEntry[]) => void;
  getPreviews: () => HistoryPreviewMap;
  setPreviews: (map: HistoryPreviewMap) => void;
  setLoaded: (value: boolean) => void;
  setError: (message: string) => void;
  setSaving: (value: boolean) => void;
  getPreviewImage: () => PreviewImage | null;
  setPreviewImage: (image: PreviewImage | null) => void;
  getEntryBusy: () => string[];
  setEntryBusy: (entries: string[]) => void;
};

const runWithSaving = async (
  adapters: Pick<HistoryControllerAdapters, 'setSaving'>,
  counter: { value: number },
  operation: () => Promise<void>
): Promise<void> => {
  counter.value += 1;
  adapters.setSaving(true);
  try {
    await operation();
  } finally {
    counter.value = Math.max(0, counter.value - 1);
    adapters.setSaving(counter.value > 0);
  }
};

const markEntryBusy = (
  adapters: Pick<HistoryControllerAdapters, 'getEntryBusy' | 'setEntryBusy'>,
  id: string,
  busy: boolean
) => {
  const current = adapters.getEntryBusy();
  if (busy) {
    if (!current.includes(id)) {
      adapters.setEntryBusy([...current, id]);
    }
    return;
  }
  if (current.length === 0) return;
  adapters.setEntryBusy(current.filter((value) => value !== id));
};

const resetHistoryPreviews = (
  adapters: Pick<HistoryControllerAdapters, 'getPreviews' | 'setPreviews'>,
  entries: HistoryEntry[]
) => {
  const cleared = clearHistoryPreviews(adapters.getPreviews());
  adapters.setPreviews(cleared);
  const built = buildHistoryPreviews(entries);
  adapters.setPreviews(built);
};

const closePreview = (
  adapters: Pick<
    HistoryControllerAdapters,
    'getPreviewImage' | 'setPreviewImage'
  >
) => {
  const current = adapters.getPreviewImage();
  if (current?.cleanup) {
    try {
      current.cleanup();
    } catch {
      /* ignore cleanup errors */
    }
  }
  adapters.setPreviewImage(null);
};

export type HistoryController = {
  initialize: () => void;
  refreshHistory: () => Promise<void>;
  saveSnapshot: (slotItem: NonNullable<ImgSlot>) => Promise<void>;
  clearAllHistory: () => Promise<void>;
  deleteEntry: (entry: HistoryEntry) => Promise<void>;
  loadHistoryImage: (entry: HistoryEntry, slot: 'left' | 'right') => void;
  openPreviewImage: (entry: HistoryEntry, blobUrl?: string) => void;
  closePreviewImage: () => void;
  destroy: () => void;
  isStoreLoaded: () => boolean;
  registerSlotSetter: (setter: SlotSetter) => void;
};

export function createHistoryController(
  adapters: HistoryControllerAdapters
): HistoryController {
  let historySavingCounter = { value: 0 };
  let unsubscribe: HistoryUnsubscriber | null = null;
  let slotSetter: SlotSetter | null = null;

  const updateEntries = (entries: HistoryEntry[]) => {
    adapters.setEntries(entries);
    resetHistoryPreviews(adapters, entries);
  };

  const initialize = () => {
    if (!unsubscribe) {
      unsubscribe = historyEntriesSubscribe((entries) => {
        updateEntries(entries);
        if (historyStoreLoaded()) {
          adapters.setLoaded(true);
        }
      });
    }
    if (historyStoreLoaded()) {
      adapters.setLoaded(true);
    }
  };

  const refreshHistory = async () => {
    adapters.setError('');
    try {
      await loadHistoryEntries();
      adapters.setLoaded(true);
    } catch (error) {
      adapters.setError(
        error instanceof Error
          ? error.message
          : `履歴の取得に失敗しました: ${String(error)}`
      );
    }
  };

  const saveSnapshot = async (slotItem: NonNullable<ImgSlot>) => {
    await runWithSaving(adapters, historySavingCounter, async () => {
      adapters.setError('');
      try {
        await addHistorySnapshot(toSlotSnapshot(slotItem));
        adapters.setLoaded(true);
      } catch (error) {
        adapters.setError(
          error instanceof Error
            ? error.message
            : `履歴の保存に失敗しました: ${String(error)}`
        );
      }
    });
  };

  const clearAllHistory = async () => {
    await runWithSaving(adapters, historySavingCounter, async () => {
      adapters.setError('');
      try {
        await clearAllHistoryEntries();
        adapters.setEntryBusy([]);
        adapters.setLoaded(true);
      } catch (error) {
        adapters.setError(
          error instanceof Error
            ? error.message
            : `履歴の削除に失敗しました: ${String(error)}`
        );
      }
    });
  };

  const deleteEntry = async (entry: HistoryEntry) => {
    markEntryBusy(adapters, entry.id, true);
    adapters.setError('');
    try {
      await removeHistoryEntry(entry.id);
    } catch (error) {
      adapters.setError(
        error instanceof Error
          ? error.message
          : `履歴の削除に失敗しました: ${String(error)}`
      );
    } finally {
      markEntryBusy(adapters, entry.id, false);
    }
  };

  const loadHistoryImage = (entry: HistoryEntry, slot: 'left' | 'right') => {
    if (!slotSetter) {
      throw new Error('setSlotFromHistory is not registered');
    }
    markEntryBusy(adapters, entry.id, true);
    adapters.setError('');
    try {
      const file = createFileFromStored(entry.image);
      slotSetter(slot, file, {
        label: entry.image.label,
        source: entry.image.source,
      });
    } catch (error) {
      adapters.setError(
        error instanceof Error
          ? error.message
          : `履歴からの再読み込みに失敗しました: ${String(error)}`
      );
    } finally {
      markEntryBusy(adapters, entry.id, false);
    }
  };

  const openPreviewImage = (entry: HistoryEntry, blobUrl?: string) => {
    closePreview(adapters);
    if (blobUrl) {
      adapters.setPreviewImage({
        src: blobUrl,
        label: entry.image.label,
      });
      return;
    }
    try {
      const file = createFileFromStored(entry.image);
      const url = URL.createObjectURL(file);
      adapters.setPreviewImage({
        src: url,
        label: entry.image.label,
        cleanup: () => URL.revokeObjectURL(url),
      });
    } catch {
      /* silently ignore preview generation errors */
    }
  };

  const closePreviewImage = () => {
    closePreview(adapters);
  };

  const destroy = () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    const cleared = clearHistoryPreviews(adapters.getPreviews());
    adapters.setPreviews(cleared);
    closePreview(adapters);
    slotSetter = null;
  };

  const isStoreLoaded = () => historyStoreLoaded();

  const registerSlotSetter = (setter: SlotSetter) => {
    slotSetter = setter;
  };

  return {
    initialize,
    refreshHistory,
    saveSnapshot,
    clearAllHistory,
    deleteEntry,
    loadHistoryImage,
    openPreviewImage,
    closePreviewImage,
    destroy,
    isStoreLoaded,
    registerSlotSetter,
  };
}
