import type { HistoryEntry, SlotSnapshot } from './history';
import {
  listHistoryEntries,
  saveHistoryEntry,
  deleteHistoryEntry,
  clearHistoryEntries,
} from './history';

type HistorySubscriber = (value: HistoryEntry[]) => void;
export type HistoryUnsubscriber = () => void;

let entries: HistoryEntry[] = [];
let loaded = false;
let loadingPromise: Promise<HistoryEntry[]> | null = null;
const subscribers = new Set<HistorySubscriber>();

function notifySubscribers(): void {
  for (const subscriber of Array.from(subscribers)) {
    subscriber(entries);
  }
}

function setEntries(next: HistoryEntry[]): HistoryEntry[] {
  entries = [...next];
  loaded = true;
  notifySubscribers();
  return entries;
}

export function historyEntriesSubscribe(
  run: HistorySubscriber
): HistoryUnsubscriber {
  run(entries);
  subscribers.add(run);
  return () => {
    subscribers.delete(run);
  };
}

export function isHistoryLoaded(): boolean {
  return loaded;
}

export async function loadHistoryEntries(): Promise<HistoryEntry[]> {
  if (!loadingPromise) {
    loadingPromise = listHistoryEntries()
      .then((result) => setEntries(result))
      .finally(() => {
        loadingPromise = null;
      });
  }
  return loadingPromise;
}

export async function addHistorySnapshot(
  snapshot: SlotSnapshot
): Promise<HistoryEntry[]> {
  const entries = await saveHistoryEntry(snapshot);
  return setEntries(entries);
}

export async function removeHistoryEntry(id: string): Promise<HistoryEntry[]> {
  const entries = await deleteHistoryEntry(id);
  return setEntries(entries);
}

export async function clearAllHistoryEntries(): Promise<HistoryEntry[]> {
  const entries = await clearHistoryEntries();
  return setEntries(entries);
}
