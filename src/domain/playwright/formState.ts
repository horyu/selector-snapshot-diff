const APP_STATE_KEY = 'domdiffer.app.v1';

export type StoredFormState = {
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

export const defaultFormState: StoredFormState = {
  url: '',
  selector: '',
  args: '',
  ua: '',
  vw: '',
  vh: '',
  waitFor: '',
  requestTimeout: '15000',
  colorScheme: '',
};

function canUseStorage(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.localStorage !== 'undefined'
    );
  } catch {
    return false;
  }
}

export function loadFormState(): StoredFormState {
  if (!canUseStorage()) return { ...defaultFormState };
  try {
    const raw = window.localStorage.getItem(APP_STATE_KEY);
    if (!raw) return { ...defaultFormState };
    const parsed = JSON.parse(raw) as Partial<StoredFormState>;
    return {
      ...defaultFormState,
      ...parsed,
    };
  } catch {
    return { ...defaultFormState };
  }
}

export function saveFormState(state: StoredFormState): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(APP_STATE_KEY, JSON.stringify(state));
  } catch {
    /* ignore storage errors */
  }
}

export function clearFormState(): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(APP_STATE_KEY);
  } catch {
    /* ignore storage errors */
  }
}

const createPlaywrightFormStore = () => {
  type Subscriber = (value: StoredFormState) => void;
  let state: StoredFormState = { ...loadFormState() };
  let suppressPersist = false;
  const subscribers = new Set<Subscriber>();

  const notify = () => {
    for (const subscriber of Array.from(subscribers)) {
      subscriber(state);
    }
  };

  const persist = () => {
    if (!suppressPersist) {
      saveFormState(state);
    }
  };

  return {
    subscribe(run: Subscriber) {
      subscribers.add(run);
      run(state);
      return () => {
        subscribers.delete(run);
      };
    },
    set(value: StoredFormState) {
      state = { ...value };
      persist();
      notify();
    },
    update(updater: (value: StoredFormState) => StoredFormState) {
      state = { ...updater(state) };
      persist();
      notify();
    },
    reset() {
      suppressPersist = true;
      state = { ...defaultFormState };
      notify();
      suppressPersist = false;
      clearFormState();
    },
  };
};

export const playwrightFormStore = createPlaywrightFormStore();
