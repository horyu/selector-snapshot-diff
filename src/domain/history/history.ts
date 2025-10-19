import {
  readHistoryStore,
  requestToPromise,
  writeHistoryStore,
} from './historyDb';

export const MAX_HISTORY_ENTRIES = 30;

export type ScreenshotPayload = {
  url: string;
  selector: string;
  args?: string[];
  userAgent?: string;
  viewport?: { width: number; height: number };
  waitFor?: string;
  colorScheme?: 'light' | 'dark' | 'no-preference';
};

export type PlaywrightFormState = {
  url: string;
  selector: string;
  args: string;
  ua: string;
  vw: string;
  vh: string;
  waitFor: string;
  requestTimeout: string;
  colorScheme: string;
};

export type SlotSource =
  | { kind: 'upload' }
  | { kind: 'paste' }
  | {
      kind: 'playwright';
      payload: ScreenshotPayload;
      form: PlaywrightFormState;
    };

export type SlotSnapshot = {
  file: File;
  name: string;
  type: string;
  label: string;
  source: SlotSource;
};

export type StoredImage = {
  name: string;
  type: string;
  label: string;
  size: number;
  blob: Blob;
  source: SlotSource;
};

export type HistoryEntry = {
  id: string;
  createdAt: number;
  image: StoredImage;
};

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID();
  const rnd = Math.random().toString(16).slice(2);
  return `${Date.now().toString(16)}-${rnd}`;
}

async function toStoredImage(snapshot: SlotSnapshot): Promise<StoredImage> {
  const { file, name, type, label, source } = snapshot;
  const blob =
    typeof file.slice === 'function'
      ? file.slice(
          0,
          file.size,
          file.type || type || 'application/octet-stream'
        )
      : new Blob([await file.arrayBuffer()], { type: file.type || type });
  return {
    name,
    type: file.type || type,
    label,
    size: file.size,
    blob,
    source,
  };
}

async function loadEntries(): Promise<HistoryEntry[]> {
  return readHistoryStore((store) => {
    const index = store.index('createdAt');
    const entries: HistoryEntry[] = [];
    return new Promise<HistoryEntry[]>((resolve, reject) => {
      const cursorRequest = index.openCursor(null, 'prev');
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) {
          resolve(entries);
          return;
        }
        entries.push(cursor.value as HistoryEntry);
        cursor.continue();
      };
      cursorRequest.onerror = () => {
        reject(
          cursorRequest.error ?? new Error('Failed to iterate history entries')
        );
      };
    });
  });
}

async function pruneEntries(): Promise<void> {
  const entries = await loadEntries();
  if (entries.length <= MAX_HISTORY_ENTRIES) return;
  const toRemove = entries.slice(MAX_HISTORY_ENTRIES);
  if (toRemove.length === 0) return;
  await writeHistoryStore(async (store) => {
    for (const entry of toRemove) {
      await requestToPromise(
        store.delete(entry.id),
        `Failed to delete history entry ${entry.id}`
      );
    }
  });
}

export async function saveHistoryEntry(
  snapshot: SlotSnapshot
): Promise<HistoryEntry[]> {
  const image = await toStoredImage(snapshot);
  const entry: HistoryEntry = {
    id: uuid(),
    createdAt: Date.now(),
    image,
  };
  await writeHistoryStore(async (store) => {
    await requestToPromise(store.put(entry), 'Failed to save history entry');
  });
  await pruneEntries();
  return loadEntries();
}

export async function listHistoryEntries(): Promise<HistoryEntry[]> {
  return loadEntries();
}

export async function deleteHistoryEntry(id: string): Promise<HistoryEntry[]> {
  await writeHistoryStore((store) =>
    requestToPromise(store.delete(id), `Failed to delete history entry ${id}`)
  );
  return loadEntries();
}

export async function clearHistoryEntries(): Promise<HistoryEntry[]> {
  await writeHistoryStore((store) =>
    requestToPromise(store.clear(), 'Failed to clear history entries')
  );
  return [];
}
