const DB_NAME = 'domdiffer-history';
const DB_VERSION = 1;
const STORE_NAME = 'entries';

export type HistoryStoreMode = 'readonly' | 'readwrite';
export type HistoryStoreCallback<T> = (
  store: IDBObjectStore,
  tx: IDBTransaction
) => Promise<T> | T;

let dbPromise: Promise<IDBDatabase> | null = null;

function getIndexedDB(): IDBFactory {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available in this environment');
  }
  return indexedDB;
}

export function requestToPromise<T>(
  request: IDBRequest<T>,
  errorMessage = 'IndexedDB request failed'
): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error(errorMessage));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () =>
      reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export async function openHistoryDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = getIndexedDB().open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => {
        reject(
          request.error ?? new Error('Failed to open history database request')
        );
      };
    });
  }
  return dbPromise;
}

export async function withHistoryStore<T>(
  mode: HistoryStoreMode,
  handler: HistoryStoreCallback<T>
): Promise<T> {
  const db = await openHistoryDb();
  const tx = db.transaction(STORE_NAME, mode);
  const done = transactionDone(tx);
  const store = tx.objectStore(STORE_NAME);

  try {
    const result = await handler(store, tx);
    await done;
    return result;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* ignore abort failures */
    }
    try {
      await done;
    } catch {
      /* swallow transaction errors after abort */
    }
    throw error;
  }
}

export function readHistoryStore<T>(
  handler: HistoryStoreCallback<T>
): Promise<T> {
  return withHistoryStore('readonly', handler);
}

export function writeHistoryStore<T>(
  handler: HistoryStoreCallback<T>
): Promise<T> {
  return withHistoryStore('readwrite', handler);
}
