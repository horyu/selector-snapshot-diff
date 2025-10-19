import { writable } from 'svelte/store';
import type { HistoryEntry, SlotSnapshot } from './history';
import {
  listHistoryEntries,
  saveHistoryEntry,
  deleteHistoryEntry,
  clearHistoryEntries,
} from './history';

const entriesStore = writable<HistoryEntry[]>([]);
let loaded = false;
let loadingPromise: Promise<HistoryEntry[]> | null = null;

async function setEntries(entries: HistoryEntry[]): Promise<HistoryEntry[]> {
  entriesStore.set(entries);
  loaded = true;
  return entries;
}

export function historyEntriesSubscribe(run: (value: HistoryEntry[]) => void) {
  return entriesStore.subscribe(run);
}

export function isHistoryLoaded(): boolean {
  return loaded;
}

export async function loadHistoryEntries(): Promise<HistoryEntry[]> {
  if (!loadingPromise) {
    loadingPromise = listHistoryEntries().then((entries) => {
      loadingPromise = null;
      return setEntries(entries);
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
